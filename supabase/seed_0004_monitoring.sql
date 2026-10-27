-- Optional SAMPLE data for Health Monitoring (fictional values) on the sample
-- engines AE451201–AE451227. Matches the sample defects in seed.sql:
-- AE451207 high oil consumption, AE451203 chip detector particles,
-- AE451219 turbine blade erosion. Run after 0004_health_monitoring.sql.

with e as (
  select id, substring(serial_number from 3)::int - 451200 as n
  from public.engines where serial_number like 'AE4512%'
)
-- Oil uplifts: roughly monthly for 6 months.
insert into public.oil_uplifts (engine_id, serviced_at, quantity_qt, flight_hours, notes)
select e.id,
       (current_date - make_interval(days => 3 + m * 30))::date,
       round((r.rate * h.hours)::numeric, 1),
       h.hours,
       case when e.n = 7 and m = 0 then 'Consumption above limit — defect raised' end
from e
cross join generate_series(0, 5) as m
cross join lateral (select (40 + (e.n * 7 + m * 5) % 25)::numeric as hours) h
cross join lateral (
  select case when e.n = 7 then 0.9 - m * 0.12
              else 0.16 + ((e.n * 7 + m * 3) % 10) / 100.0 end as rate
) r;

with e as (
  select id, substring(serial_number from 3)::int - 451200 as n
  from public.engines where serial_number like 'AE4512%'
)
-- Oil samples (SOAP): every two months.
insert into public.oil_samples (engine_id, sampled_at, lab_ref, fe, cu, ag, mg, cr, ni, ti, al, level, recommendation)
select e.id,
       (current_date - make_interval(days => 6 + m * 60))::date,
       'SOAP-' || to_char(current_date - make_interval(days => 6 + m * 60), 'YYMM') || '-' || lpad(e.n::text, 3, '0'),
       case when e.n = 3 and m = 0 then 6.8 when e.n = 7 and m = 0 then 3.9 else 1.0 + (e.n % 5) * 0.4 + m * 0.1 end,
       case when e.n = 7 and m = 0 then 2.1 else 0.4 + (e.n % 3) * 0.2 end,
       0.1, 0.3, 0.2, 0.2, 0.1, 0.5,
       case when e.n in (3, 7) and m = 0 then 'caution' else 'normal' end,
       case when e.n = 3 and m = 0 then 'Iron rising — resample in 10 FH and check chip detectors'
            when e.n = 7 and m = 0 then 'Copper/iron elevated — resample, review oil consumption' end
from e
cross join generate_series(0, 2) as m;

with e as (
  select id, substring(serial_number from 3)::int - 451200 as n
  from public.engines where serial_number like 'AE4512%'
)
-- Chip detector checks: monthly, reduction gearbox.
insert into public.chip_checks (engine_id, checked_at, location, finding, action_taken)
select e.id,
       (current_date - make_interval(days => 9 + m * 30))::date,
       'Reduction gearbox',
       case when e.n = 3 and m = 0 then 'fine_particles'
            when (e.n + m) % 6 = 0 then 'fuzz' else 'clean' end,
       case when e.n = 3 and m = 0 then 'Debris sent for analysis; detector cleaned and refitted, recheck after 5 FH' end
from e
cross join generate_series(0, 3) as m;

-- Borescope inspections: a few engines.
insert into public.borescope_inspections (engine_id, inspected_at, area, findings, disposition, next_due, reference)
select en.id, v.inspected_at, v.area, v.findings, v.disposition, v.next_due, v.reference
from (values
  ('AE451219', current_date - 14, 'Turbine 1st stage', 'Minor leading-edge erosion on 3 blades, within limits', 'monitor', current_date + 46, 'WO-BSI-0419'),
  ('AE451219', current_date - 120, 'Turbine 1st stage', 'No defects noted', 'serviceable', null, 'WO-BSI-0311'),
  ('AE451207', current_date - 20, 'Combustor', 'Light carbon deposits on liners', 'serviceable', null, 'WO-BSI-0412'),
  ('AE451213', current_date - 35, 'Compressor', 'Nick on 5th stage blade, blended within limits', 'reduced_interval', current_date + 25, 'WO-BSI-0398'),
  ('AE451204', current_date - 60, 'Turbine 2nd stage', 'No defects noted', 'serviceable', null, 'WO-BSI-0377'),
  ('AE451216', current_date - 75, 'Combustor', 'No defects noted', 'serviceable', null, 'WO-BSI-0360')
) as v(serial, inspected_at, area, findings, disposition, next_due, reference)
join public.engines en on en.serial_number = v.serial;
