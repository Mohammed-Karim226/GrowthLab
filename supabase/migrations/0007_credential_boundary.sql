-- Apply in maintenance mode before deploying the new credential UI/API.
alter table public.client_gmail_accounts add column secret_ciphertext text;
alter table public.client_gmail_accounts add column has_secret boolean not null default false;
alter table public.client_gmail_accounts add column services jsonb not null default '[]';
-- Legacy plaintext remains quarantined pending the controlled repair script.
-- Column grants prevent direct authenticated PostgREST access, including admins.
revoke all on public.client_gmail_accounts from anon, authenticated;
grant select (id, client_id, email, has_secret, services, created_at, updated_at)
  on public.client_gmail_accounts to authenticated;

create function public.save_credential(p_id uuid, p_client uuid, p_email text,
  p_ciphertext text, p_services jsonb, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  if p_ciphertext !~ '^v1\.[A-Za-z0-9_-]+\.' or octet_length(p_ciphertext)>65536 then
    raise exception 'invalid ciphertext';
  end if;
  insert into public.client_gmail_accounts(id,client_id,email,password,related_accounts,notes,secret_ciphertext,has_secret,services)
  values(p_id,p_client,p_email,'','[]',null,p_ciphertext,true,p_services)
  on conflict(id) do update set email=excluded.email, password='', related_accounts='[]',
    notes=null, secret_ciphertext=excluded.secret_ciphertext,has_secret=true,services=excluded.services
  where public.client_gmail_accounts.client_id=p_client;
  if not found then raise exception 'credential owner mismatch'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(p_actor,'CREDENTIAL_SAVED','client_gmail_account',p_id);
end $$;
create function public.delete_credential(p_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  delete from public.client_gmail_accounts where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(p_actor,'CREDENTIAL_DELETED','client_gmail_account',p_id);
end $$;
revoke all on function public.save_credential(uuid,uuid,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.delete_credential(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_credential(uuid,uuid,text,text,jsonb,uuid) to service_role;
grant execute on function public.delete_credential(uuid,uuid) to service_role;
