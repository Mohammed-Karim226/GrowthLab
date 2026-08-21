create table if not exists public.client_payment_plans (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  billing_month date not null,
  amount        numeric(12,2) not null check (amount >= 0),
  total_plan_price numeric(12,2) check (total_plan_price is null or total_plan_price >= 0),
  currency      text not null default 'USD',
  status        text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived')),
  due_date      date,
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, billing_month)
);

create index if not exists client_payment_plans_client_month_idx
  on public.client_payment_plans (client_id, billing_month desc);

drop trigger if exists client_payment_plans_set_updated_at on public.client_payment_plans;
create trigger client_payment_plans_set_updated_at before update on public.client_payment_plans
  for each row execute function public.set_updated_at();

alter table public.client_payment_plans enable row level security;

drop policy if exists client_payment_plans_admin_all on public.client_payment_plans;
create policy client_payment_plans_admin_all on public.client_payment_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists client_payment_plans_select_own on public.client_payment_plans;
create policy client_payment_plans_select_own on public.client_payment_plans
  for select to authenticated using (client_id = public.auth_client_id());
