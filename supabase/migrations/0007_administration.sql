-- Step 7: Administration.
--   • profiles.active — deactivated users lose all access (reads and writes) and
--     are blocked from signing in again
--   • the last active administrator can't be demoted or deactivated
--   • admin-only RPCs: list users (with e-mail), create a user, reset a password
-- Run once in Supabase → SQL Editor after 0006.

alter table public.profiles add column active boolean not null default true;

-- Inactive users have no role, so every role-based policy denies them.
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

-- Every "<table> read" policy (open to all signed-in users) now requires an
-- active account. The audit log keeps its own role-based read rule.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and policyname like '% read' and tablename <> 'audit_log'
  loop
    execute format('alter policy %I on public.%I using ((select public.is_active_user()))', p.policyname, p.tablename);
  end loop;
end $$;

-- Guard rails on role and status changes.
create or replace function public.protect_admins()
returns trigger language plpgsql as $$
begin
  if new.id = auth.uid() and not new.active then
    raise exception 'You cannot deactivate your own account.';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'HERMES needs at least one active administrator.';
  end if;
  return new;
end $$;

create trigger protect_admins before update on public.profiles
  for each row execute function public.protect_admins();

-- Deactivation also blocks sign-in at the auth layer.
create or replace function public.sync_user_ban()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
  set banned_until = case when new.active then null else 'infinity'::timestamptz end
  where id = new.id;
  return new;
end $$;

create trigger sync_ban after update of active on public.profiles
  for each row when (old.active is distinct from new.active)
  execute function public.sync_user_ban();

-- ─── Admin RPCs ─────────────────────────────────────────────────────────────
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
end $$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, full_name text, rank text, service_no text, squadron text,
  role public.user_role, active boolean, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, p.full_name, p.rank, p.service_no, p.squadron, p.role, p.active,
           u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.active desc, p.role, p.full_name;
end $$;

-- Creates a confirmed e-mail/password user (same method as snippets/create_user.sql).
create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text, p_rank text,
  p_service_no text, p_squadron text, p_role public.user_role
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  perform public.require_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid e-mail address.';
  end if;
  if length(coalesce(p_password, '')) < 10 then
    raise exception 'Password must be at least 10 characters.';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'A user with that e-mail already exists.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text, 'email',
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );

  -- handle_new_user() created the profile; fill in the rest.
  update public.profiles
  set full_name = nullif(trim(p_full_name), ''), rank = nullif(trim(p_rank), ''),
      service_no = nullif(trim(p_service_no), ''), squadron = nullif(trim(p_squadron), ''),
      role = p_role
  where id = v_uid;

  return v_uid;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if length(coalesce(p_password, '')) < 10 then
    raise exception 'Password must be at least 10 characters.';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
  if not found then
    raise exception 'User not found.';
  end if;
end $$;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_create_user(text, text, text, text, text, text, public.user_role) from public, anon;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, text, text, public.user_role) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
