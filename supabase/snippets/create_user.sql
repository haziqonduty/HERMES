-- Create a HERMES user (email already confirmed) and assign a role.
-- Edit the five values at the top, then run in Supabase → SQL Editor.
-- Roles: admin, oc_engineering, commander, supervisor, planner, engineer, viewer

do $$
declare
  v_email     text := 'name@example.com';
  v_password  text := 'ChangeMe!2026';
  v_full_name text := 'Full Name';
  v_rank      text := 'Capt';
  v_role      public.user_role := 'engineer';
  v_uid       uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = lower(v_email)) then
    raise exception 'User % already exists', v_email;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(v_email), extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', v_full_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text, 'email',
    jsonb_build_object('sub', v_uid::text, 'email', lower(v_email), 'email_verified', true),
    now(), now(), now()
  );

  -- The on_auth_user_created trigger already made the profile; set rank and role.
  update public.profiles
  set full_name = v_full_name, rank = v_rank, role = v_role
  where id = v_uid;

  raise notice 'Created % as %', v_email, v_role;
end $$;
