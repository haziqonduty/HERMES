-- Fixes from the 2026-10-31 code review.
--   1. Database clock in Malaysia time, so current_date (defect closed dates,
--      work-order start/completion dates, defaults) matches the users' day.
--   2. Engine-change day: a flight on the day an engine is removed counts for the
--      replacement engine only (was counted for both). Matches engine_hours_monthly.
--   3. install_engine refuses retired engines, future dates and dates that overlap
--      the engine's previous installation.
--   4. Engine status can't contradict the installation record: "Installed" only via
--      install, and an installed engine must be removed before changing status.
--   5. Supervisors and OC Engineering can delete a wrong flight log (hours/cycles are
--      subtracted again automatically). Previously only admins could.
-- Run once in Supabase → SQL Editor after 0008.

-- 1 ─────────────────────────────────────────────────────────────────────────
alter database postgres set timezone to 'Asia/Kuala_Lumpur';

-- 2 ─────────────────────────────────────────────────────────────────────────
create or replace function public.apply_flight(
  p_aircraft uuid, p_date date, p_hours numeric, p_cycles integer, p_sign integer
) returns void language plpgsql set search_path = '' as $$
begin
  update public.aircraft
  set total_hours  = total_hours  + p_sign * p_hours,
      total_cycles = total_cycles + p_sign * p_cycles
  where id = p_aircraft;

  -- An engine removed on the flight date did not fly that day; its replacement did.
  update public.engines e
  set tsn = e.tsn + p_sign * p_hours,
      csn = e.csn + p_sign * p_cycles,
      tso = case when e.tso is null then null else e.tso + p_sign * p_hours end,
      cso = case when e.cso is null then null else e.cso + p_sign * p_cycles end
  where e.id in (
    select i.engine_id from public.engine_installations i
    where i.aircraft_id = p_aircraft
      and i.installed_at <= p_date
      and (i.removed_at is null or i.removed_at > p_date)
  );
end $$;

-- 3 ─────────────────────────────────────────────────────────────────────────
create or replace function public.install_engine(
  p_engine uuid, p_aircraft uuid, p_position smallint, p_date date
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_positions smallint;
  v_status public.engine_status;
  v_last_removed date;
begin
  select engine_positions into v_positions from public.aircraft where id = p_aircraft;
  if v_positions is null then raise exception 'Aircraft not found'; end if;
  if p_position > v_positions then
    raise exception 'Position % does not exist on this aircraft (max %)', p_position, v_positions;
  end if;

  select status into v_status from public.engines where id = p_engine;
  if v_status is null then raise exception 'Engine not found'; end if;
  if v_status = 'retired' then raise exception 'A retired engine cannot be installed.'; end if;
  if p_date > current_date then raise exception 'The install date cannot be in the future.'; end if;

  select max(removed_at) into v_last_removed from public.engine_installations where engine_id = p_engine;
  if v_last_removed is not null and p_date < v_last_removed then
    raise exception 'This engine was last removed on %; the install date must be on or after that.', v_last_removed;
  end if;

  insert into public.engine_installations (engine_id, aircraft_id, position, installed_at)
  values (p_engine, p_aircraft, p_position, p_date)
  returning id into v_id;

  update public.engines set status = 'installed' where id = p_engine;
  return v_id;
end $$;

-- 4 ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_engine_status()
returns trigger language plpgsql set search_path = '' as $$
declare v_fitted boolean;
begin
  if new.status is distinct from old.status then
    select exists (select 1 from public.engine_installations where engine_id = new.id and removed_at is null) into v_fitted;
    if new.status = 'installed' and not v_fitted then
      raise exception 'Install the engine from the aircraft page — the status "Installed" is set automatically.';
    end if;
    if new.status <> 'installed' and v_fitted then
      raise exception 'Remove the engine from its aircraft first — the status follows the removal.';
    end if;
  end if;
  return new;
end $$;

create trigger guard_status before update of status on public.engines
  for each row execute function public.guard_engine_status();

-- 5 ─────────────────────────────────────────────────────────────────────────
drop policy "flight_logs delete" on public.flight_logs;
create policy "flight_logs delete" on public.flight_logs
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'oc_engineering', 'supervisor'));
