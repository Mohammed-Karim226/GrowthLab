-- One event per completed AI provider attempt, including retries and failures.
-- Deliberately excludes prompts, generated content, credentials and identities.
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 1 and 100),
  model text not null check (char_length(model) between 1 and 200),
  status text not null check (status in ('success', 'error')),
  error_kind text check (error_kind in ('auth', 'rate_limit', 'timeout', 'network', 'bad_response', 'blocked', 'unknown')),
  status_code integer check (status_code between 100 and 599),
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  total_tokens bigint check (total_tokens >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  started_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_outcome check (
    (status = 'success' and error_kind is null)
    or (status = 'error' and error_kind is not null)
  )
);

comment on column public.ai_usage_events.input_tokens is
  'Provider promptTokenCount, including image input; null means unreported. Used for input TPM.';
comment on column public.ai_usage_events.total_tokens is
  'Provider totalTokenCount, including thinking when reported; null means unreported, not zero.';

create index ai_usage_events_started_at_idx on public.ai_usage_events (started_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from public, anon, authenticated, service_role;
grant select on public.ai_usage_events to authenticated;
grant insert on public.ai_usage_events to service_role;
create policy ai_usage_events_admin_read on public.ai_usage_events
  for select to authenticated using ((select public.is_admin()));

-- Aggregate in PostgreSQL so PostgREST's row limit cannot truncate usage.
-- SECURITY INVOKER keeps RLS effective; the explicit guard also rejects a
-- non-admin even when no events exist. Use the signed-in admin session client.
create or replace function public.admin_ai_usage_summary()
returns jsonb
language plpgsql stable security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  window_end timestamptz := now();
  window_start timestamptz := window_end - interval '24 hours';
  minute_start timestamptz := window_end - interval '1 minute';
  day_start timestamptz := date_trunc('day', window_end at time zone 'UTC') at time zone 'UTC';
  result jsonb;
begin
  if public.is_admin() is not true then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  with window_events as materialized (
    select model, status, error_kind, input_tokens, total_tokens, duration_ms, started_at
    from public.ai_usage_events
    where started_at >= window_start and started_at <= window_end
  ), totals as (
    select count(*) as requests,
      count(*) filter (where status = 'success') as succeeded,
      count(*) filter (where status = 'error') as failed,
      count(*) filter (where error_kind = 'rate_limit') as rate_limited,
      coalesce(sum(total_tokens), 0) as tokens,
      count(total_tokens) as token_samples,
      round(avg(duration_ms)) as average_latency_ms
    from window_events
  ), model_totals as (
    select model, count(*) as requests,
      count(*) filter (where status = 'error') as failed,
      coalesce(sum(total_tokens), 0) as tokens,
      count(total_tokens) as token_samples,
      count(*) filter (where started_at >= minute_start) as minute_requests,
      coalesce(sum(input_tokens) filter (where started_at >= minute_start), 0) as minute_input_tokens,
      count(input_tokens) filter (where started_at >= minute_start) as minute_token_samples,
      count(*) filter (where started_at >= day_start) as day_requests
    from window_events
    group by model
  ), hourly_totals as (
    select date_trunc('hour', started_at) as hour,
      count(*) as requests,
      count(*) filter (where status = 'error') as failed
    from window_events
    group by date_trunc('hour', started_at)
  ), hours as (
    -- Rolling 24h has partial first/last clock hours; include both boundaries.
    select generate_series(
      date_trunc('hour', window_start),
      date_trunc('hour', window_end),
      interval '1 hour'
    ) as hour
  )
  select jsonb_build_object(
    'since', window_start,
    'requests', totals.requests,
    'succeeded', totals.succeeded,
    'failed', totals.failed,
    'rateLimited', totals.rate_limited,
    'tokens', totals.tokens,
    'tokenSamples', totals.token_samples,
    'averageLatencyMs', totals.average_latency_ms,
    'models', coalesce((
      select jsonb_agg(jsonb_build_object(
        'model', model,
        'requests', requests,
        'failed', failed,
        'tokens', tokens,
        'tokenSamples', token_samples,
        'minuteRequests', minute_requests,
        'minuteInputTokens', minute_input_tokens,
        'minuteTokenSamples', minute_token_samples,
        'dayRequests', day_requests
      ) order by requests desc, model)
      from model_totals
    ), '[]'::jsonb),
    'hourly', (
      select jsonb_agg(jsonb_build_object(
        'hour', hours.hour,
        'requests', coalesce(hourly_totals.requests, 0),
        'failed', coalesce(hourly_totals.failed, 0)
      ) order by hours.hour)
      from hours left join hourly_totals using (hour)
    )
  ) into result
  from totals;

  return result;
end;
$$;

revoke all on function public.admin_ai_usage_summary() from public, anon, service_role;
grant execute on function public.admin_ai_usage_summary() to authenticated;

notify pgrst, 'reload schema';
