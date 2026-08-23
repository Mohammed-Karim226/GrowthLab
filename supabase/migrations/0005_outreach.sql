-- Outreach CRM: reusable contacts/senders and message status tracking.
create type public.outreach_message_status as enum ('draft', 'ready', 'sent', 'replied', 'no_reply', 'closed');

create table if not exists public.outreach_senders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  email text not null,
  signature text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  company text,
  channel text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.outreach_contacts(id) on delete cascade,
  sender_id uuid references public.outreach_senders(id) on delete set null,
  subject text not null,
  body text not null,
  goal text,
  status public.outreach_message_status not null default 'draft',
  sent_at timestamptz,
  replied_at timestamptz,
  last_event text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_messages_status_idx on public.outreach_messages(status, updated_at desc);
create index if not exists outreach_messages_contact_idx on public.outreach_messages(contact_id, created_at desc);

do $$ begin
  create trigger outreach_senders_set_updated_at before update on public.outreach_senders
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger outreach_contacts_set_updated_at before update on public.outreach_contacts
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger outreach_messages_set_updated_at before update on public.outreach_messages
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.outreach_senders enable row level security;
alter table public.outreach_contacts enable row level security;
alter table public.outreach_messages enable row level security;
create policy outreach_senders_admin on public.outreach_senders for all using (public.is_admin()) with check (public.is_admin());
create policy outreach_contacts_admin on public.outreach_contacts for all using (public.is_admin()) with check (public.is_admin());
create policy outreach_messages_admin on public.outreach_messages for all using (public.is_admin()) with check (public.is_admin());
