-- Admin-maintained audience totals, displayed on the client's active accounts.
-- Existing accounts stay unknown (NULL) until an admin supplies a count.
alter table public.accounts add column if not exists audience_count bigint;

do $$ begin
  alter table public.accounts add constraint accounts_audience_count_check
    check (audience_count between 0 and 9007199254740991);
exception when duplicate_object then null;
end $$;

comment on column public.accounts.audience_count is
  'Admin-maintained follower count, or subscriber count for YouTube. NULL means unknown.';

-- Existing account RLS continues to restrict writes to admins and reads to owners.
notify pgrst, 'reload schema';
