alter table public.clients add column if not exists project_name text;
alter table public.clients add column if not exists service_description text;
alter table public.clients add column if not exists followup_priority text not null default 'normal';
alter table public.clients drop constraint if exists clients_followup_priority_check;
alter table public.clients add constraint clients_followup_priority_check check (followup_priority in ('low', 'normal', 'high'));
