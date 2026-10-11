-- Summary changes may require withdrawing approval, but authenticated callers
-- must not regain direct access to report status or publication columns.
-- Keep the withdrawal, narrative save, and audit entries in one transaction.
create or replace function public.save_report_summary(
  p_report uuid,
  p_version uuid,
  p_revision integer,
  p_summary jsonb,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
) returns public.report_versions
language plpgsql security definer set search_path='' as $$
declare
  r public.reports;
  v public.report_versions;
  required_reapproval boolean;
  regenerated boolean;
  audit_metadata jsonb;
begin
  if public.is_admin() is not true then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('generate','edit') then
    raise exception 'unknown summary action' using errcode='22023';
  end if;
  if jsonb_typeof(p_summary) is distinct from 'object' then
    raise exception 'invalid summary' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) is distinct from 'object' then
    raise exception 'invalid metadata' using errcode='22023';
  end if;

  -- Match the transition RPC's lock order to serialize approval/publication
  -- with this save. A changed metric or narrative invalidates the snapshot.
  select * into r from public.reports where id=p_report for update;
  if not found then raise exception 'report missing' using errcode='55000'; end if;
  select * into v from public.report_versions where id=p_version and report_id=r.id for update;
  if not found then raise exception 'version mismatch' using errcode='55000'; end if;
  if v.revision is distinct from p_revision then
    raise exception 'stale report' using errcode='40001';
  end if;
  if v.status in ('published','archived') then
    raise exception 'version locked' using errcode='55000';
  end if;
  if exists(
    select 1 from public.ai_jobs j join public.insight_batches b on b.id=j.insight_batch_id
    where b.report_version_id=v.id and j.status in ('queued','processing')
  ) then
    raise exception 'active job' using errcode='55000';
  end if;

  required_reapproval := v.status='approved';
  regenerated := v.ai_summary is not null;
  if required_reapproval then
    -- guard_version checks OLD.status, so approval must be withdrawn before
    -- changing the narrative. Any later failure rolls this transition back too.
    select * into v from public.transition_report(
      r.id,v.id,v.revision,r.current_published_version_id,'reopen'
    );
  end if;

  update public.report_versions
    set ai_summary=p_summary,
        status=case when p_action='generate' then 'needs_review'::public.report_status else v.status end
    where id=v.id
    returning * into v;

  -- Route metadata is already sanitized. Database-owned facts always win over
  -- supplied keys, including the previous summary and approval state.
  audit_metadata := coalesce(p_metadata,'{}'::jsonb)
    - array['report_id','version_number','required_reapproval','regenerated']::text[]
    || jsonb_build_object(
      'report_id',r.id,
      'version_number',v.version_number,
      'required_reapproval',required_reapproval
    );
  if p_action='generate' then
    audit_metadata := audit_metadata || jsonb_build_object('regenerated',regenerated);
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(
      auth.uid(),
      case when p_action='generate' then 'SUMMARY_GENERATED' else 'SUMMARY_EDITED' end,
      'report_version',v.id,audit_metadata
    );
  return v;
end $$;

revoke all on function public.save_report_summary(uuid,uuid,integer,jsonb,text,jsonb) from public,anon;
grant execute on function public.save_report_summary(uuid,uuid,integer,jsonb,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
