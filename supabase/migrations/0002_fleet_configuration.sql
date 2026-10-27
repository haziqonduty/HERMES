-- Step 2: fleet configuration. Engine install/remove functions and automatic
-- flying-hours roll-up from flight logs to aircraft and installed engines.
-- Run once in Supabase → SQL Editor after 0001_foundation.sql.

-- Number of engine positions per aircraft (4 for C-130, 2 for twin helicopters…)
alter table public.aircraft
  add column engine_positions smallint not null default 4 check (engine_positions between 1 and 8);

-- ─── Install / remove (atomic, RLS applies to the caller) ───────────────────
create or replace function public.install_engine(
  p_engine uuid, p_aircraft uuid, p_position smallint, p_date date
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_positions smallint;
begin
  select engine_positions into v_positions from public.aircraft where id = p_aircraft;
  if v_positions is null then raise exception 'Aircraft not found'; end if;
  if p_position > v_positions then
    raise exception 'Position % does not exist on this aircraft (max %)', p_position, v_positions;
  end if;

  insert into public.engine_installations (engine_id, aircraft_id, position, installed_at)
  values (p_engine, p_aircraft, p_position, p_date)
  returning id into v_id;

  update public.engines set status = 'installed' where id = p_engine;
  return v_id;
end $$;

create or replace function public.remove_engine(
  p_installation uuid, p_date date, p_reason text, p_engine_status public.engine_status
) returns void language plpgsql set search_path = '' as $$
declare v_engine uuid;
begin
  if p_engine_status = 'installed' then
    raise exception 'A removed engine cannot have status "installed"';
  end if;

  update public.engine_installations
  set removed_at = p_date, removal_reason = nullif(trim(p_reason), '')
  where id = p_installation and removed_at is null
  returning engine_id into v_engine;

  if v_engine is null then raise exception 'Installation not found or already removed'; end if;

  update public.engines set status = p_engine_status where id = v_engine;
end $$;

-- ─── Flying hours roll-up ───────────────────────────────────────────────────
-- Adds (or subtracts, sign = -1) a flight's hours/cycles to the aircraft and to
-- every engine installed on that aircraft on the flight date.
create or replace function public.apply_flight(
  p_aircraft uuid, p_date date, p_hours numeric, p_cycles integer, p_sign integer
) returns void language plpgsql set search_path = '' as $$
begin
  update public.aircraft
  set total_hours  = total_hours  + p_sign * p_hours,
      total_cycles = total_cycles + p_sign * p_cycles
  where id = p_aircraft;

  update public.engines e
  set tsn = e.tsn + p_sign * p_hours,
      csn = e.csn + p_sign * p_cycles,
      tso = case when e.tso is null then null else e.tso + p_sign * p_hours end,
      cso = case when e.cso is null then null else e.cso + p_sign * p_cycles end
  where e.id in (
    select i.engine_id from public.engine_installations i
    where i.aircraft_id = p_aircraft
      and i.installed_at <= p_date
      and (i.removed_at is null or i.removed_at >= p_date)
  );
end $$;

create or replace function public.flight_logs_rollup()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.apply_flight(old.aircraft_id, old.flight_date, old.flight_hours, old.cycles, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.apply_flight(new.aircraft_id, new.flight_date, new.flight_hours, new.cycles, 1);
    return new;
  end if;
  return old;
end $$;

create trigger rollup after insert or update or delete on public.flight_logs
  for each row execute function public.flight_logs_rollup();
