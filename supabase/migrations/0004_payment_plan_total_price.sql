alter table public.client_payment_plans
  add column if not exists total_plan_price numeric(12,2)
  check (total_plan_price is null or total_plan_price >= 0);

notify pgrst, 'reload schema';
