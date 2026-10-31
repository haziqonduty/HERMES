-- Reset a HERMES user's password (e.g. a forgotten admin password).
-- 1. Run the first query to see the accounts and find the right e-mail.
-- 2. Edit the e-mail and new password in the second block, then run it.
-- Run in Supabase → SQL Editor. Never save a real password in this file.

select email, last_sign_in_at, banned_until from auth.users order by email;

do $$
declare
  v_email    text := 'name@example.com';
  v_password text := 'ChangeMe!2026';   -- at least 10 characters
begin
  if length(v_password) < 10 then
    raise exception 'Password must be at least 10 characters.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
      banned_until = null,              -- also lifts a deactivation ban
      updated_at = now()
  where email = lower(v_email);

  if not found then
    raise exception 'No user with e-mail %', v_email;
  end if;

  -- Make sure the HERMES profile is active too.
  update public.profiles set active = true
  where id = (select id from auth.users where email = lower(v_email));

  raise notice 'Password reset for %', v_email;
end $$;
