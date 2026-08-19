-- Durable AI work queue. Web requests enqueue; independent workers claim jobs.

do $$ begin
  create type public.ai_job_status as enum (
    'queued', 'processing', 'completed', 'failed', 'dead_letter'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.ai_jobs (
  id                uuid primary key default gen_random_uuid(),
  insight_batch_id  uuid not null references public.insight_batches (id) on delete cascade,
  status            public.ai_job_status not null default 'queued',
  force_run         boolean not null default false,
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  available_at      timestamptz not null default now(),
  locked_by         text,
  lease_expires_at  timestamptz,
  requested_by      uuid references auth.users (id) on delete set null,
  result            jsonb,
  error_key         text,
  error_detail      text,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  constraint ai_jobs_attempts_valid check (attempts >= 0 and max_attempts > 0)
);

create index if not exists ai_jobs_claim_idx
  on public.ai_jobs (available_at, created_at)
  where status in ('queued', 'processing');
create index if not exists ai_jobs_batch_idx
  on public.ai_jobs (insight_batch_id, created_at desc);
create unique index if not exists ai_jobs_one_active_per_batch_idx
  on public.ai_jobs (insight_batch_id)
  where status in ('queued', 'processing');

alter table public.ai_jobs enable row level security;

drop policy if exists ai_jobs_admin_select on public.ai_jobs;
create policy ai_jobs_admin_select on public.ai_jobs
  for select to authenticated using (public.is_admin());

-- Enqueue and lock the batch in one transaction. Concurrent clicks return the
-- existing active job rather than creating duplicate provider calls.
create or replace function public.enqueue_ai_job(
  batch_id uuid,
  force_requested boolean default false
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.ai_jobs;
  created public.ai_jobs;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into existing
  from public.ai_jobs
  where insight_batch_id = batch_id
    and status in ('queued', 'processing')
  order by created_at desc
  limit 1;

  if found then return existing; end if;

  insert into public.ai_jobs (insight_batch_id, force_run, requested_by)
  values (batch_id, force_requested, auth.uid())
  returning * into created;

  update public.insight_batches
  set status = 'processing'
  where id = batch_id;

  return created;
exception when unique_violation then
  select * into existing
  from public.ai_jobs
  where insight_batch_id = batch_id
    and status in ('queued', 'processing')
  order by created_at desc
  limit 1;
  return existing;
end;
$$;

revoke all on function public.enqueue_ai_job(uuid, boolean) from public;
grant execute on function public.enqueue_ai_job(uuid, boolean) to authenticated;

-- Workers use the service role. SKIP LOCKED permits multiple worker processes
-- without allowing two of them to claim the same job.
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
  with candidate as (
    select id
    from public.ai_jobs
    where (
      status = 'queued' and available_at <= now()
    ) or (
      status = 'processing' and lease_expires_at < now() and attempts < max_attempts
    )
    order by available_at, created_at
    for update skip locked
    limit 1
  )
  update public.ai_jobs job
  set status = 'processing',
      locked_by = worker_name,
      lease_expires_at = now() + make_interval(secs => greatest(lease_seconds, 60)),
      attempts = attempts + 1,
      started_at = coalesce(started_at, now()),
      error_key = null,
      error_detail = null
  from candidate
  where job.id = candidate.id
  returning job.* into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_ai_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_job(text, integer) to service_role;

create or replace function public.finish_ai_job(job_id uuid, job_result jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare batch_id uuid;
begin
  update public.ai_jobs
  set status = 'completed', result = job_result, completed_at = now(),
      locked_by = null, lease_expires_at = null
  where id = job_id and status = 'processing'
  returning insight_batch_id into batch_id;

  update public.insight_batches set status = 'needs_review' where id = batch_id;
end;
$$;

create or replace function public.fail_ai_job(
  job_id uuid,
  failure_key text,
  failure_detail text,
  retry_delay_seconds integer default 30
)
returns public.ai_job_status language plpgsql security definer set search_path = '' as $$
declare job public.ai_jobs;
declare next_status public.ai_job_status;
begin
  select * into job from public.ai_jobs where id = job_id for update;
  if not found then raise exception 'job not found'; end if;

  next_status := case when job.attempts < job.max_attempts then 'queued' else 'dead_letter' end;
  update public.ai_jobs
  set status = next_status,
      available_at = case when next_status = 'queued'
        then now() + make_interval(secs => greatest(retry_delay_seconds, 1)) else available_at end,
      error_key = failure_key,
      error_detail = left(failure_detail, 2000),
      locked_by = null,
      lease_expires_at = null,
      completed_at = case when next_status = 'dead_letter' then now() else null end
  where id = job_id;

  if next_status = 'dead_letter' then
    update public.insight_batches set status = 'failed' where id = job.insight_batch_id;
  end if;
  return next_status;
end;
$$;

revoke all on function public.finish_ai_job(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_job(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.finish_ai_job(uuid, jsonb) to service_role;
grant execute on function public.fail_ai_job(uuid, text, text, integer) to service_role;
