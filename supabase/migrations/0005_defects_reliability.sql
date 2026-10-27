-- Step 5: Defect Management + Reliability Analytics.
-- Defects get a reference number, failure classification and deferral date;
-- engine removals are classified (scheduled / unscheduled, confirmed failure)
-- so MTBUR / MTBF can be calculated. Run once in Supabase → SQL Editor after 0004.

-- ─── Defects ────────────────────────────────────────────────────────────────
create sequence public.defect_no_seq;

alter table public.defects
  add column defect_no        text unique,
  add column failure_mode     text,      -- classification for Pareto analysis
  add column detection_method text,      -- how it was found
  add column root_cause       text,
  add column deferred_until   date;

-- Number existing defects in date order: DEF-YY-0001.
update public.defects d
set defect_no = 'DEF-' || to_char(d.reported_at, 'YY') || '-' || lpad(o.rn::text, 4, '0')
from (select id, row_number() over (order by reported_at, created_at) as rn from public.defects) o
where d.id = o.id;

select setval('public.defect_no_seq',
              greatest((select count(*) from public.defects), 1),
              (select count(*) from public.defects) > 0);

-- New defects get a number; closing stamps the closed date, reopening clears it.
create or replace function public.defect_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.defect_no is null then
    new.defect_no := 'DEF-' || to_char(new.reported_at, 'YY') || '-' || lpad(nextval('public.defect_no_seq')::text, 4, '0');
  end if;
  if new.status = 'closed' then
    new.closed_at := coalesce(new.closed_at, current_date);
  else
    new.closed_at := null;
  end if;
  if new.status <> 'deferred' then new.deferred_until := null; end if;
  return new;
end $$;

create trigger lifecycle before insert or update on public.defects
  for each row execute function public.defect_lifecycle();

create index on public.defects (engine_id);
create index on public.defects (aircraft_id);

-- ─── Engine removals ────────────────────────────────────────────────────────
alter table public.engine_installations
  add column removal_type      text check (removal_type in ('scheduled', 'unscheduled')),
  add column failure_mode      text,
  add column confirmed_failure boolean,
  add column defect_id         uuid references public.defects on delete set null;

drop function public.remove_engine(uuid, date, text, public.engine_status);

create function public.remove_engine(
  p_installation uuid,
  p_date date,
  p_reason text,
  p_engine_status public.engine_status,
  p_removal_type text,
  p_failure_mode text default null,
  p_confirmed_failure boolean default null,
  p_defect uuid default null
) returns void language plpgsql set search_path = '' as $$
declare v_engine uuid;
begin
  if p_engine_status = 'installed' then
    raise exception 'A removed engine cannot have status "installed"';
  end if;
  if p_removal_type not in ('scheduled', 'unscheduled') then
    raise exception 'Removal type must be scheduled or unscheduled';
  end if;

  update public.engine_installations
  set removed_at        = p_date,
      removal_reason    = nullif(trim(p_reason), ''),
      removal_type      = p_removal_type,
      failure_mode      = case when p_removal_type = 'unscheduled' then nullif(trim(p_failure_mode), '') end,
      confirmed_failure = case when p_removal_type = 'unscheduled' then coalesce(p_confirmed_failure, false) end,
      defect_id         = p_defect
  where id = p_installation and removed_at is null
  returning engine_id into v_engine;

  if v_engine is null then raise exception 'Installation not found or already removed'; end if;

  update public.engines set status = p_engine_status where id = v_engine;
end $$;

-- ─── Engine flying hours per month (for MTBUR / MTBF) ───────────────────────
-- Each flight counts once per engine fitted to the aircraft on the flight date.
create view public.engine_hours_monthly with (security_invoker = true) as
select
  date_trunc('month', f.flight_date)::date as month,
  count(*)                                  as flights,
  sum(f.flight_hours)                       as aircraft_hours,
  sum(f.flight_hours * fitted.n)            as engine_hours
from public.flight_logs f
cross join lateral (
  select count(*) as n
  from public.engine_installations i
  where i.aircraft_id = f.aircraft_id
    and i.installed_at <= f.flight_date
    and (i.removed_at is null or i.removed_at > f.flight_date)
) fitted
group by 1;
