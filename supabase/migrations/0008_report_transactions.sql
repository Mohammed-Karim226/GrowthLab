-- Existing inconsistent pointers/versions must be repaired explicitly before this migration.
alter table public.report_versions add column revision integer not null default 0;
alter table public.report_versions add constraint versions_report_identity unique(report_id,id);
alter table public.reports add constraint reports_same_version_fk
  foreign key(id,current_published_version_id) references public.report_versions(report_id,id)
  deferrable initially deferred;
alter table public.insight_batches add constraint batches_version_identity unique(report_version_id,id);
alter table public.metrics add constraint metrics_same_batch_version_fk
  foreign key(report_version_id,insight_batch_id) references public.insight_batches(report_version_id,id);

-- Seal approved facts. All child writers, including service-role jobs and direct
-- PostgREST writes, lock the same version row. An approved report must be withdrawn
-- to needs_review before editing; published corrections use a new version.
create function public.lock_editable_version(p_version uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v public.report_versions;
begin
  select * into v from public.report_versions where id=p_version for update;
  if not found then raise exception 'version missing' using errcode='55000'; end if;
  if v.status in ('approved','published','archived') then
    raise exception 'version locked' using errcode='55000';
  end if;
  update public.report_versions set revision=revision+1 where id=p_version;
end $$;
revoke all on function public.lock_editable_version(uuid) from public,anon,authenticated;

create function public.guard_version() returns trigger
language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.status <> 'draft' then raise exception 'new versions must be drafts' using errcode='55000'; end if;
  else
    if new.report_id<>old.report_id or new.version_number<>old.version_number then
      raise exception 'version identity immutable' using errcode='55000';
    end if;
    if old.status in ('approved','published','archived') and
      (new.summary is distinct from old.summary or new.ai_summary is distinct from old.ai_summary) then
      raise exception 'version locked' using errcode='55000';
    end if;
    new.revision := old.revision+1;
  end if;
  return new;
end $$;
create trigger guard_version before insert or update on public.report_versions
  for each row execute function public.guard_version();

create function public.guard_fact_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare version_id uuid; batch_id uuid;
begin
  if TG_TABLE_NAME='insight_images' then
    batch_id := case when TG_OP='DELETE' then old.insight_batch_id else new.insight_batch_id end;
    select report_version_id into version_id from public.insight_batches where id=batch_id;
  else
    version_id := case when TG_OP='DELETE' then old.report_version_id else new.report_version_id end;
  end if;
  -- A parent cascade has already deleted its version/batch. Cleanup triggers still run.
  if TG_OP='DELETE' and not exists(select 1 from public.report_versions where id=version_id) then return old; end if;
  if TG_OP='UPDATE' then
    if TG_TABLE_NAME='insight_images' then
      if new.insight_batch_id<>old.insight_batch_id or new.storage_path<>old.storage_path then raise exception 'image identity immutable'; end if;
    elsif new.report_version_id<>old.report_version_id then raise exception 'fact owner immutable'; end if;
  end if;
  perform public.lock_editable_version(version_id);
  if TG_TABLE_NAME in ('insight_images','insight_batches') and exists(
    select 1 from public.ai_jobs j join public.insight_batches b on b.id=j.insight_batch_id
    where b.report_version_id=version_id and j.status in ('queued','processing')
  ) then raise exception 'active job' using errcode='55000'; end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_metrics before insert or update or delete on public.metrics for each row execute function public.guard_fact_write();
create trigger guard_images before insert or update or delete on public.insight_images for each row execute function public.guard_fact_write();
create trigger guard_batches before insert or delete or update of report_version_id,platform,account_id,notes on public.insight_batches for each row execute function public.guard_fact_write();

-- Transitions cannot be bypassed by direct authenticated writes.
revoke update on public.report_versions from authenticated;
grant update(summary,ai_summary) on public.report_versions to authenticated;
revoke update on public.reports from authenticated;
grant update(title,period_start,period_end) on public.reports to authenticated;

create function public.transition_report(p_report uuid,p_version uuid,p_revision integer,
  p_expected_published uuid,p_action text) returns public.report_versions
language plpgsql security definer set search_path='' as $$
declare r public.reports; v public.report_versions;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into r from public.reports where id=p_report for update;
  if not found then raise exception 'report missing' using errcode='55000'; end if;
  select * into v from public.report_versions where id=p_version and report_id=r.id for update;
  if not found then raise exception 'version mismatch' using errcode='55000'; end if;
  if v.revision<>p_revision or r.current_published_version_id is distinct from p_expected_published then
    raise exception 'stale report' using errcode='40001';
  end if;
  if exists(select 1 from public.ai_jobs j join public.insight_batches b on b.id=j.insight_batch_id
    where b.report_version_id=v.id and j.status in ('queued','processing')) then
    raise exception 'active job' using errcode='55000';
  end if;
  if p_action in ('approve','publish') then
    if not exists(select 1 from public.metrics where report_version_id=v.id) or
       exists(select 1 from public.metrics where report_version_id=v.id and needs_review) then
      raise exception 'review required' using errcode='55000';
    end if;
  end if;
  if p_action='approve' then
    if v.status not in ('draft','needs_review','failed') then raise exception 'invalid state' using errcode='55000'; end if;
    update public.insight_batches set status='approved' where report_version_id=v.id;
    update public.report_versions set status='approved' where id=v.id returning * into v;
  elsif p_action='publish' then
    if v.status<>'approved' then raise exception 'approval required' using errcode='55000'; end if;
    update public.report_versions set status='archived' where report_id=r.id and status='published';
    update public.report_versions set status='published',published_at=now() where id=v.id returning * into v;
    update public.reports set current_published_version_id=v.id where id=r.id;
  elsif p_action='unpublish' then
    if v.status<>'published' or r.current_published_version_id<>v.id then raise exception 'invalid state' using errcode='55000'; end if;
    update public.reports set current_published_version_id=null where id=r.id;
    update public.report_versions set status='approved',published_at=null where id=v.id returning * into v;
  elsif p_action='reopen' then
    if v.status<>'approved' then raise exception 'invalid state' using errcode='55000'; end if;
    update public.report_versions set status='needs_review' where id=v.id returning * into v;
    update public.insight_batches set status='needs_review' where report_version_id=v.id;
  else raise exception 'unknown transition'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'REPORT_'||upper(p_action),'report_version',v.id,jsonb_build_object('report_id',r.id,'revision',v.revision));
  return v;
end $$;
revoke all on function public.transition_report(uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.transition_report(uuid,uuid,integer,uuid,text) to authenticated;

create function public.check_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare report_id uuid;
begin
  report_id := case when TG_TABLE_NAME='reports' then new.id else new.report_id end;
  if exists(select 1 from public.reports r where r.id=report_id and
    ((r.current_published_version_id is not null and not exists(select 1 from public.report_versions v where v.id=r.current_published_version_id and v.report_id=r.id and v.status='published')) or
    exists(select 1 from public.report_versions v where v.report_id=r.id and v.status='published' and v.id is distinct from r.current_published_version_id))) then
    raise exception 'publication invariant' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger check_report_publication after insert or update on public.reports
  deferrable initially deferred for each row execute function public.check_publication();
create constraint trigger check_version_publication after insert or update on public.report_versions
  deferrable initially deferred for each row execute function public.check_publication();

-- Active tenant binding is evaluated on every RLS read, including existing sessions.
create or replace function public.auth_client_id() returns uuid language sql stable security definer set search_path='' as $$
  select p.client_id from public.profiles p join public.clients c on c.id=p.client_id
    where p.id=auth.uid() and p.role='client' and c.is_active;
$$;
drop policy report_versions_select_published on public.report_versions;
create policy report_versions_select_published on public.report_versions for select to authenticated using (
  status='published' and exists(select 1 from public.reports r where r.id=report_id and r.client_id=public.auth_client_id() and r.current_published_version_id=report_versions.id));
drop policy metrics_select_published on public.metrics;
create policy metrics_select_published on public.metrics for select to authenticated using (
  exists(select 1 from public.reports r join public.report_versions v on v.id=r.current_published_version_id
    where v.id=metrics.report_version_id and v.report_id=r.id and v.status='published' and r.client_id=public.auth_client_id()));

-- Safe attribution only; batch notes, status and internal timestamps stay private.
create function public.portal_attribution(p_versions uuid[]) returns table(batch_id uuid,version_id uuid,account_id uuid,account_name text,account_stage text)
language sql stable security definer set search_path='' as $$
  select b.id,b.report_version_id,b.account_id,coalesce(a.page_name,a.page_id),a.stage
  from public.insight_batches b join public.report_versions v on v.id=b.report_version_id
  join public.reports r on r.id=v.report_id left join public.accounts a on a.id=b.account_id and a.client_id=r.client_id
  where b.report_version_id=any(p_versions) and cardinality(p_versions)<=100
    and v.status='published' and r.current_published_version_id=v.id and r.client_id=public.auth_client_id();
$$;
revoke all on function public.portal_attribution(uuid[]) from public,anon;
grant execute on function public.portal_attribution(uuid[]) to authenticated;
