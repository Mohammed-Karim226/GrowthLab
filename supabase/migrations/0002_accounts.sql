-- Upgrade existing installations to account-aware insight batches.
-- Safe to run after 0001 on databases created before account support existed.

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  platform    public.platform_type not null,
  page_name   text,
  page_id     text,
  stage       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists accounts_client_idx on public.accounts (client_id);
create unique index if not exists accounts_client_platform_page_idx
  on public.accounts (client_id, platform, page_id) where page_id is not null;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.insight_batches add column if not exists account_id uuid;

alter table public.insight_batches
  drop constraint if exists insight_batches_report_version_id_platform_key;
alter table public.insight_batches
  drop constraint if exists insight_batches_account_id_fkey;
alter table public.insight_batches
  add constraint insight_batches_account_id_fkey
  foreign key (account_id) references public.accounts (id) on delete restrict;

drop index if exists insight_batches_version_platform_single_idx;
drop index if exists insight_batches_version_platform_account_idx;
create unique index insight_batches_version_platform_single_idx
  on public.insight_batches (report_version_id, platform) where account_id is null;
create unique index insight_batches_version_platform_account_idx
  on public.insight_batches (report_version_id, platform, account_id) where account_id is not null;

create or replace function public.validate_insight_batch_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare account_row public.accounts%rowtype;
declare report_client uuid;
begin
  if new.account_id is null then return new; end if;
  select * into account_row from public.accounts where id = new.account_id;
  if not found or account_row.platform <> new.platform then
    raise exception 'Account does not match batch platform';
  end if;
  select r.client_id into report_client
  from public.report_versions rv join public.reports r on r.id = rv.report_id
  where rv.id = new.report_version_id;
  if report_client is null or report_client <> account_row.client_id then
    raise exception 'Account does not belong to report client';
  end if;
  return new;
end $$;

drop trigger if exists insight_batches_validate_account on public.insight_batches;
create trigger insight_batches_validate_account before insert or update of account_id, platform, report_version_id
  on public.insight_batches for each row execute function public.validate_insight_batch_account();

alter table public.accounts enable row level security;
drop policy if exists accounts_admin_all on public.accounts;
create policy accounts_admin_all on public.accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select to authenticated using (client_id = public.auth_client_id());
