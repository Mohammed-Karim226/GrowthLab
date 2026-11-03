-- Keep publication changes atomic while allowing administrators to withdraw a
-- report even when a stale AI job is still queued or processing. The withdrawn
-- version remains approved, so its facts stay sealed by the existing triggers.
-- This replaces only the transition function; existing report data is untouched.
create or replace function public.transition_report(
  p_report uuid,
  p_version uuid,
  p_revision integer,
  p_expected_published uuid,
  p_action text
) returns public.report_versions
language plpgsql security definer set search_path='' as $$
declare r public.reports; v public.report_versions;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_action is null or p_action not in ('approve','publish','unpublish','reopen') then
    raise exception 'unknown transition' using errcode='22023';
  end if;

  select * into r from public.reports where id=p_report for update;
  if not found then raise exception 'report missing' using errcode='55000'; end if;
  select * into v from public.report_versions where id=p_version and report_id=r.id for update;
  if not found then raise exception 'version mismatch' using errcode='55000'; end if;

  -- NULL must not bypass the optimistic concurrency check.
  if v.revision is distinct from p_revision or
     r.current_published_version_id is distinct from p_expected_published then
    raise exception 'stale report' using errcode='40001';
  end if;

  if p_action <> 'unpublish' and exists(
    select 1 from public.ai_jobs j join public.insight_batches b on b.id=j.insight_batch_id
    where b.report_version_id=v.id and j.status in ('queued','processing')
  ) then
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
    if v.status<>'published' or r.current_published_version_id is distinct from v.id then
      raise exception 'invalid state' using errcode='55000';
    end if;
    update public.reports set current_published_version_id=null where id=r.id;
    update public.report_versions set status='approved',published_at=null where id=v.id returning * into v;
  elsif p_action='reopen' then
    if v.status<>'approved' then raise exception 'invalid state' using errcode='55000'; end if;
    update public.report_versions set status='needs_review' where id=v.id returning * into v;
    update public.insight_batches set status='needs_review' where report_version_id=v.id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'REPORT_'||upper(p_action),'report_version',v.id,jsonb_build_object('report_id',r.id,'revision',v.revision));
  return v;
end $$;

revoke all on function public.transition_report(uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.transition_report(uuid,uuid,integer,uuid,text) to authenticated;
