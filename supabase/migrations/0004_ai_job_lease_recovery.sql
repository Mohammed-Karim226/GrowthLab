-- Mark a job dead after its final worker lease expires instead of leaving the
-- batch permanently stuck in processing.
create or replace function public.claim_ai_job(
  worker_name text,
  lease_seconds integer default 600
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare claimed public.ai_jobs;
begin
  with exhausted as (
    update public.ai_jobs
    set status = 'dead_letter', completed_at = now(), locked_by = null,
        lease_expires_at = null, error_key = coalesce(error_key, 'aiFailed'),
        error_detail = coalesce(error_detail, 'Worker lease expired after the final attempt')
    where status = 'processing' and lease_expires_at < now() and attempts >= max_attempts
    returning insight_batch_id
  )
  update public.insight_batches batch
  set status = 'failed'
  where batch.id in (select insight_batch_id from exhausted);

  with candidate as (
    select id from public.ai_jobs
    where (status = 'queued' and available_at <= now())
       or (status = 'processing' and lease_expires_at < now() and attempts < max_attempts)
    order by available_at, created_at
    for update skip locked
    limit 1
  )
  update public.ai_jobs job
  set status = 'processing', locked_by = worker_name,
      lease_expires_at = now() + make_interval(secs => greatest(lease_seconds, 60)),
      attempts = attempts + 1, started_at = coalesce(started_at, now()),
      error_key = null, error_detail = null
  from candidate where job.id = candidate.id
  returning job.* into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_ai_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_job(text, integer) to service_role;
