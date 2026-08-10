-- ============================================================================
-- GrowthLab — Client Analytics Portal
-- Migration 0001: schema, helper functions, RLS, storage policies
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
-- Idempotent where practical so a partial run can be replayed safely.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
--   Add a platform later with:  alter type public.platform_type add value 'linkedin';
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.platform_type as enum ('facebook', 'instagram', 'tiktok', 'youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('admin', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum (
    'draft', 'processing', 'needs_review', 'approved', 'published', 'archived', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.batch_status as enum (
    'draft', 'uploading', 'uploaded', 'processing', 'needs_review', 'approved', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.metric_source as enum ('ai', 'manual', 'calculated', 'imported');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analysis_status as enum ('pending', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients
--   The business receiving GrowthLab services. Never stores credentials.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_email text,
  company_name  text,
  avatar_url    text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists clients_is_active_idx on public.clients (is_active);
create index if not exists clients_created_at_idx on public.clients (created_at desc);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles
--   1:1 with auth.users. Carries the role and the tenant binding.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'client',
  client_id  uuid references public.clients (id) on delete restrict,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- admin may have a null client_id; a client MUST be bound to one
  constraint profiles_client_binding check (
    (role = 'admin') or (role = 'client' and client_id is not null)
  )
);

create index if not exists profiles_client_id_idx on public.profiles (client_id);
create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
--
--   SECURITY DEFINER so they read `profiles` without re-entering the RLS
--   policies that call them (this is what prevents infinite recursion).
--   `search_path = ''` forces fully-qualified names so the function cannot be
--   hijacked by a caller-controlled search_path.
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.auth_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.client_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.auth_role() from public;
revoke all on function public.auth_client_id() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_client_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- reports
--   One reporting period for one client. `current_published_version_id` points
--   at the version the client should see; older versions stay intact.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id                           uuid primary key default gen_random_uuid(),
  client_id                    uuid not null references public.clients (id) on delete cascade,
  title                        text not null,
  period_start                 date not null,
  period_end                   date not null,
  current_published_version_id uuid,
  created_by                   uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint reports_period_order check (period_end >= period_start)
);

create index if not exists reports_client_period_idx on public.reports (client_id, period_end desc);
create index if not exists reports_published_idx on public.reports (client_id)
  where current_published_version_id is not null;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- report_versions
--   Immutable-ish history. Publishing a correction creates v2 rather than
--   destroying v1.
-- ---------------------------------------------------------------------------
create table if not exists public.report_versions (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports (id) on delete cascade,
  version_number integer not null,
  status         public.report_status not null default 'draft',
  summary        text,
  ai_summary     jsonb,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  unique (report_id, version_number)
);

create index if not exists report_versions_report_idx
  on public.report_versions (report_id, version_number desc);
create index if not exists report_versions_status_idx on public.report_versions (status);

drop trigger if exists report_versions_set_updated_at on public.report_versions;
create trigger report_versions_set_updated_at before update on public.report_versions
  for each row execute function public.set_updated_at();

do $$ begin
  alter table public.reports
    add constraint reports_current_version_fk
    foreign key (current_published_version_id)
    references public.report_versions (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- insight_batches
--   One platform's screenshots for one report version.
-- ---------------------------------------------------------------------------
create table if not exists public.insight_batches (
  id                uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.report_versions (id) on delete cascade,
  platform          public.platform_type not null,
  status            public.batch_status not null default 'draft',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (report_version_id, platform)
);

create index if not exists insight_batches_version_platform_idx
  on public.insight_batches (report_version_id, platform);

drop trigger if exists insight_batches_set_updated_at on public.insight_batches;
create trigger insight_batches_set_updated_at before update on public.insight_batches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- insight_images
--   Uploads are additive; a path is never reused.
-- ---------------------------------------------------------------------------
create table if not exists public.insight_images (
  id                uuid primary key default gen_random_uuid(),
  insight_batch_id  uuid not null references public.insight_batches (id) on delete cascade,
  storage_path      text not null unique,
  original_filename text,
  mime_type         text,
  file_size         integer,
  sort_order        integer not null default 0,
  uploaded_by       uuid references auth.users (id) on delete set null,
  uploaded_at       timestamptz not null default now()
);

create index if not exists insight_images_batch_idx
  on public.insight_images (insight_batch_id, sort_order);

-- ---------------------------------------------------------------------------
-- ai_analyses
--   Audit trail of what the model actually returned. Never shown to clients.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_analyses (
  id                  uuid primary key default gen_random_uuid(),
  insight_batch_id    uuid not null references public.insight_batches (id) on delete cascade,
  provider            text not null,
  model               text not null,
  attempt             integer not null default 1,
  status              public.analysis_status not null default 'pending',
  raw_response        text,
  structured_response jsonb,
  error_message       text,
  image_count         integer not null default 0,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists ai_analyses_batch_idx
  on public.ai_analyses (insight_batch_id, created_at desc);
create index if not exists ai_analyses_status_idx on public.ai_analyses (status);

-- ---------------------------------------------------------------------------
-- metrics
--   Flexible per-platform metric store. `metric_value` is nullable on purpose:
--   a metric the model could not read is recorded as NULL, never invented.
-- ---------------------------------------------------------------------------
create table if not exists public.metrics (
  id                uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.report_versions (id) on delete cascade,
  insight_batch_id  uuid references public.insight_batches (id) on delete cascade,
  platform          public.platform_type not null,
  metric_name       text not null,
  metric_value      numeric,
  metric_unit       text not null default 'count',
  metric_date       date,
  source            public.metric_source not null default 'ai',
  confidence        numeric,
  needs_review      boolean not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint metrics_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists metrics_version_platform_idx
  on public.metrics (report_version_id, platform, metric_date);
create index if not exists metrics_batch_idx on public.metrics (insight_batch_id);
create index if not exists metrics_needs_review_idx
  on public.metrics (report_version_id) where needs_review;

drop trigger if exists metrics_set_updated_at on public.metrics;
create trigger metrics_set_updated_at before update on public.metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ============================================================================
-- ROW LEVEL SECURITY
--
--   Model:
--     admin  -> full access to every tenant table
--     client -> SELECT only, and only rows reachable from their own client_id
--               through a PUBLISHED report version
--   Anything not matched by a policy is denied. The service-role key bypasses
--   RLS entirely and is used only in trusted server code.
-- ============================================================================

alter table public.clients         enable row level security;
alter table public.profiles        enable row level security;
alter table public.reports         enable row level security;
alter table public.report_versions enable row level security;
alter table public.insight_batches enable row level security;
alter table public.insight_images  enable row level security;
alter table public.ai_analyses     enable row level security;
alter table public.metrics         enable row level security;
alter table public.audit_logs      enable row level security;

-- clients ------------------------------------------------------------------
drop policy if exists clients_admin_all on public.clients;
create policy clients_admin_all on public.clients
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated
  using (id = public.auth_client_id());

-- profiles -----------------------------------------------------------------
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A user may read their own profile row and nobody else's.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- reports ------------------------------------------------------------------
drop policy if exists reports_admin_all on public.reports;
create policy reports_admin_all on public.reports
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_select_published on public.reports;
create policy reports_select_published on public.reports
  for select to authenticated
  using (
    client_id = public.auth_client_id()
    and current_published_version_id is not null
  );

-- report_versions ----------------------------------------------------------
drop policy if exists report_versions_admin_all on public.report_versions;
create policy report_versions_admin_all on public.report_versions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A client sees a version only when it is published AND belongs to a report
-- owned by their client organisation.
drop policy if exists report_versions_select_published on public.report_versions;
create policy report_versions_select_published on public.report_versions
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.reports r
      where r.id = report_versions.report_id
        and r.client_id = public.auth_client_id()
    )
  );

-- insight_batches ----------------------------------------------------------
-- Admin only. Clients have no reason to see upload plumbing.
drop policy if exists insight_batches_admin_all on public.insight_batches;
create policy insight_batches_admin_all on public.insight_batches
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- insight_images -----------------------------------------------------------
-- Admin only: raw screenshots are never exposed to clients.
drop policy if exists insight_images_admin_all on public.insight_images;
create policy insight_images_admin_all on public.insight_images
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ai_analyses --------------------------------------------------------------
-- Admin only: raw model output is an internal audit artefact.
drop policy if exists ai_analyses_admin_all on public.ai_analyses;
create policy ai_analyses_admin_all on public.ai_analyses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- metrics ------------------------------------------------------------------
drop policy if exists metrics_admin_all on public.metrics;
create policy metrics_admin_all on public.metrics
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- SELECT only, and only through a published version of one of their reports.
-- No INSERT/UPDATE/DELETE policy exists for clients, so those are denied.
drop policy if exists metrics_select_published on public.metrics;
create policy metrics_select_published on public.metrics
  for select to authenticated
  using (
    exists (
      select 1
      from public.report_versions rv
      join public.reports r on r.id = rv.report_id
      where rv.id = metrics.report_version_id
        and rv.status = 'published'
        and r.client_id = public.auth_client_id()
    )
  );

-- audit_logs ---------------------------------------------------------------
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_admin_insert on public.audit_logs;
create policy audit_logs_admin_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_admin());

-- ============================================================================
-- STORAGE
--   Private bucket. No public URLs; signed URLs are minted server-side for
--   admins only.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insights',
  'insights',
  false,
  10485760, -- 10 MB, mirrored by MAX_UPLOAD_BYTES in the app
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists insights_admin_select on storage.objects;
create policy insights_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'insights' and public.is_admin());

drop policy if exists insights_admin_insert on storage.objects;
create policy insights_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'insights' and public.is_admin());

drop policy if exists insights_admin_update on storage.objects;
create policy insights_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'insights' and public.is_admin())
  with check (bucket_id = 'insights' and public.is_admin());

drop policy if exists insights_admin_delete on storage.objects;
create policy insights_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'insights' and public.is_admin());
