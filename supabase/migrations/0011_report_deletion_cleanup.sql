-- Keep the cleanup manifest after the report graph disappears. External object
-- deletion and Inngest cancellation happen after this transaction commits.
create table if not exists public.report_deletion_cleanup (
  report_id uuid primary key,
  storage_prefix text not null,
  storage_paths text[] not null default '{}'::text[],
  job_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  storage_cleaned_at timestamptz,
  jobs_cancelled_at timestamptz,
  completed_at timestamptz
);
create index if not exists report_deletion_cleanup_pending_idx
  on public.report_deletion_cleanup(last_attempt_at nulls first,created_at,report_id)
  where completed_at is null;

alter table public.report_deletion_cleanup enable row level security;
revoke all on public.report_deletion_cleanup from public,anon,authenticated,service_role;
grant select on public.report_deletion_cleanup to authenticated;
grant select,update,delete on public.report_deletion_cleanup to service_role;
drop policy if exists report_deletion_cleanup_admin_select on public.report_deletion_cleanup;
create policy report_deletion_cleanup_admin_select on public.report_deletion_cleanup
  for select to authenticated using (public.is_admin());

create or replace function public.capture_report_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  paths text[];
  jobs uuid[];
begin
  if old.current_published_version_id is not null then
    raise exception 'published report' using errcode='55000';
  end if;

  -- DELETE already holds the report row. Follow the transition lock order;
  -- version locks stop fact writes and batch locks stop new job/analysis FKs.
  perform v.id from public.report_versions v
    where v.report_id=old.id order by v.id for update;
  perform b.id from public.insight_batches b
    join public.report_versions v on v.id=b.report_version_id
    where v.report_id=old.id order by b.id for update of b;

  select coalesce(array_agg(i.storage_path order by i.storage_path),'{}'::text[])
    into paths from public.insight_images i
    join public.insight_batches b on b.id=i.insight_batch_id
    join public.report_versions v on v.id=b.report_version_id
    where v.report_id=old.id;
  select coalesce(array_agg(j.id order by j.id),'{}'::uuid[])
    into jobs from public.ai_jobs j
    join public.insight_batches b on b.id=j.insight_batch_id
    join public.report_versions v on v.id=b.report_version_id
    where v.report_id=old.id;

  insert into public.report_deletion_cleanup(report_id,storage_prefix,storage_paths,job_ids)
    values(old.id,'clients/'||old.client_id::text||'/reports/'||old.id::text,paths,jobs);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'REPORT_DELETED','report',old.id,jsonb_build_object(
      'image_count',cardinality(paths),'job_count',cardinality(jobs),'cleanup_pending',true
    ));
  return old;
end $$;
revoke all on function public.capture_report_deletion() from public,anon,authenticated;

-- Capture direct deletes and client cascades too, so they cannot orphan objects
-- by bypassing the API. The existing foreign keys remove the whole report graph.
drop trigger if exists capture_report_deletion on public.reports;
create trigger capture_report_deletion before delete on public.reports
  for each row execute function public.capture_report_deletion();

create or replace function public.delete_report(p_report uuid)
returns public.report_deletion_cleanup
language plpgsql security definer set search_path='' as $$
declare
  r public.reports;
  cleanup public.report_deletion_cleanup;
begin
  if public.is_admin() is not true then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  select * into r from public.reports where id=p_report for update;
  if found then
    delete from public.reports where id=r.id;
  end if;

  -- Retrying after an interrupted HTTP response must resume the same cleanup.
  select * into cleanup from public.report_deletion_cleanup where report_id=p_report;
  if not found then raise exception 'report missing' using errcode='55000'; end if;
  return cleanup;
end $$;
revoke all on function public.delete_report(uuid) from public,anon;
grant execute on function public.delete_report(uuid) to authenticated;

notify pgrst, 'reload schema';
