-- My Account: users maintain their own profile details and can see their own
-- activity in the audit trail. Role and account status stay admin-only.
-- Run once in Supabase → SQL Editor after 0007.

create policy "profiles self update" on public.profiles
  for update to authenticated
  using (id = auth.uid() and (select public.is_active_user()))
  with check (id = auth.uid());

-- Only administrators may change a role or account status. Statements with no
-- signed-in user (SQL Editor, admin RPCs' own updates run as admin) are allowed.
create or replace function public.protect_role_changes()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and public.current_user_role() is distinct from 'admin'
     and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'Only an administrator can change roles or account status.';
  end if;
  return new;
end $$;

create trigger protect_role_changes before update on public.profiles
  for each row execute function public.protect_role_changes();

-- Everyone can see their own audit trail.
create policy "audit read own" on public.audit_log
  for select to authenticated
  using (actor = auth.uid() and (select public.is_active_user()));
