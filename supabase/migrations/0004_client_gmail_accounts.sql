create table if not exists public.client_gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  email text not null,
  password text not null,
  notes text,
  related_accounts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_gmail_accounts_client_idx on public.client_gmail_accounts (client_id);
create unique index if not exists client_gmail_accounts_client_email_idx on public.client_gmail_accounts (client_id, lower(email));
drop trigger if exists client_gmail_accounts_set_updated_at on public.client_gmail_accounts;
create trigger client_gmail_accounts_set_updated_at before update on public.client_gmail_accounts for each row execute function public.set_updated_at();
alter table public.client_gmail_accounts enable row level security;
drop policy if exists client_gmail_accounts_admin_all on public.client_gmail_accounts;
create policy client_gmail_accounts_admin_all on public.client_gmail_accounts for all using (public.is_admin()) with check (public.is_admin());
