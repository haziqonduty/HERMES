-- Optional SAMPLE data for Defect Management + Reliability Analytics (fictional).
-- Run after 0005_defects_reliability.sql. Adds:
--   • failure classification on the 5 sample defects + 36 historical defects
--   • 13 previously-fitted engines (AE451301–313, now at overhaul) with classified removals
--   • 2 years of historical flight logs (life totals are NOT changed — the hours
--     are treated as already included in each engine's TSN/TSO)

-- ─── Classify the existing sample defects ───────────────────────────────────
update public.defects d
set failure_mode = v.mode, detection_method = v.how
from (values
  ('Oil consumption trending high — 0.9 qt/hr',       'Oil leak / consumption', 'Health monitoring'),
  ('Vibration exceedance on reduction gearbox',       'Vibration',              'Pilot report'),
  ('Chip detector — fine ferrous particles found',     'Contamination / debris', 'Scheduled inspection'),
  ('Borescope: minor erosion turbine 1st stage blade', 'Blade erosion / damage', 'Borescope'),
  ('Nose gear steering actuator leak',               'Seal / gasket',          'Pilot report')
) as v(descr, mode, how)
where d.description = v.descr;

-- ─── Historical defects (oldest first so numbers follow dates) ──────────────
insert into public.defects
  (aircraft_id, engine_id, reported_at, ata_chapter, system, description, severity, status,
   failure_mode, detection_method, root_cause, action_taken, closed_at, deferred_until)
select
  i.aircraft_id, e.id,
  current_date - (g * 10 + 3),
  m.ata, m.sys, m.descr,
  (array['minor', 'major', 'minor', 'critical', 'minor', 'major'])[1 + g % 6]::public.defect_severity,
  case when g <= 3 then 'in_work' when g = 4 then 'deferred' else 'closed' end::public.defect_status,
  m.mode,
  (array['Pilot report', 'Scheduled inspection', 'Health monitoring', 'Ground run'])[1 + g % 4],
  case when g > 4 then m.cause end,
  case when g > 4 then m.fix end,
  case when g > 4 then current_date - (g * 10 + 3) + (1 + (g * 5) % 12) end,
  case when g = 4 then current_date + 21 end
from generate_series(36, 1, -1) as g
-- Weighted so the Pareto has a clear "vital few".
cross join lateral (
  select * from (values
    (0,  'Oil leak / consumption', '79', 'Oil',          'Oil seep at reduction gearbox scavenge line',  'Loose B-nut',                'Torqued and leak-checked'),
    (1,  'Oil leak / consumption', '79', 'Oil',          'Oil consumption above trend',                  'Worn carbon seal',           'Seal replaced'),
    (2,  'Contamination / debris', '79', 'Oil',          'Chip detector caution light',                  'Bearing cage wear debris',   'Detector cleaned, oil sampled'),
    (3,  'Oil leak / consumption', '79', 'Oil',          'Oil on nacelle lower panel',                   'Cracked oil cooler flange',  'Flange gasket replaced'),
    (4,  'Vibration',              '72', 'Engine',       'Vibration above limit at cruise power',        'Propeller imbalance',        'Dynamic balance carried out'),
    (5,  'Contamination / debris', '73', 'Fuel',         'Fuel filter bypass indication',                'Contaminated fuel filter',   'Filter replaced, fuel sampled'),
    (6,  'Overtemperature',        '77', 'Indicating',   'TIT fluctuation during take-off',              'Faulty thermocouple harness','Harness replaced'),
    (7,  'Oil leak / consumption', '79', 'Oil',          'Oil leak at accessory gearbox pad',            'O-ring degraded',            'O-ring replaced'),
    (8,  'Control / electrical',   '76', 'Engine controls','Torque indication erratic',                  'Connector corrosion',        'Connector cleaned and resealed'),
    (9,  'Contamination / debris', '79', 'Oil',          'Fuzz on chip detector above normal',           'Normal wear — trend watch',  'Detector cleaned, recheck 10 FH'),
    (10, 'Blade erosion / damage', '72', 'Hot section',  'Borescope: nick on compressor blade',          'FOD ingestion',              'Blended within limits'),
    (11, 'Bearing wear',           '72', 'Engine',       'Rough running at idle',                        'No.4 bearing wear',          'Engine removed for repair')
  ) as t(k, mode, ata, sys, descr, cause, fix)
  where t.k = (g * 7) % 12
) m
join public.engines e on e.serial_number = 'AE' || (451200 + 1 + (g * 5) % 24)
join public.engine_installations i on i.engine_id = e.id and i.removed_at is null
order by g desc;

-- ─── Previously-fitted engines and their removals ───────────────────────────
insert into public.engines (serial_number, model, manufacturer, status, tsn, csn, tso, cso, overhaul_interval_hours, notes)
select 'AE4513' || lpad(k::text, 2, '0'), 'T56-A-15', 'Rolls-Royce (Allison)', 'in_overhaul',
       16000 + k * 410, 10500 + k * 280, 1200 + (k * 271) % 2700, 800 + (k * 187) % 1800, 4000,
       'Sample engine — removed and sent for overhaul/repair'
from generate_series(1, 13) as k;

with cur as (
  select i.aircraft_id, i.position, i.installed_at,
         row_number() over (order by i.installed_at desc, i.position) as k
  from public.engine_installations i
  join public.engines e on e.id = i.engine_id
  where i.removed_at is null and e.serial_number like 'AE4512%'
    and i.installed_at >= current_date - 730
)
insert into public.engine_installations
  (engine_id, aircraft_id, position, installed_at, removed_at, removal_reason, removal_type, failure_mode, confirmed_failure)
select e.id, cur.aircraft_id, cur.position, cur.installed_at - 900, cur.installed_at, r.reason, r.kind, r.mode, r.confirmed
from cur
join public.engines e on e.serial_number = 'AE4513' || lpad(cur.k::text, 2, '0')
join (values
  (1,  'High oil consumption — exceeded limit',              'unscheduled', 'Oil leak / consumption', true),
  (2,  'Hard time — overhaul due',                           'scheduled',   null,                     null),
  (3,  'Chip light — metal on reduction gearbox detector',   'unscheduled', 'Contamination / debris', true),
  (4,  'Vibration exceedance — no fault found at shop',      'unscheduled', 'Vibration',              false),
  (5,  'Hard time — overhaul due',                           'scheduled',   null,                     null),
  (6,  'Borescope reject — turbine blade damage',            'unscheduled', 'Blade erosion / damage', true),
  (7,  'Suspected oil leak — not confirmed at shop',         'unscheduled', 'Oil leak / consumption', false),
  (8,  'Hard time — overhaul due',                           'scheduled',   null,                     null),
  (9,  'Repeated chip detector findings',                    'unscheduled', 'Contamination / debris', true),
  (10, 'TIT exceedance during take-off',                     'unscheduled', 'Overtemperature',        true),
  (11, 'Hard time — overhaul due',                           'scheduled',   null,                     null),
  (12, 'Rough running — No.4 bearing wear',                  'unscheduled', 'Bearing wear',           true),
  (13, 'Fleet campaign — module upgrade',                    'scheduled',   null,                     null)
) as r(k, reason, kind, mode, confirmed) on r.k = cur.k;

-- ─── Two years of flight history (roll-up disabled: totals already include it) ──
alter table public.flight_logs disable trigger rollup;

insert into public.flight_logs (aircraft_id, flight_date, flight_hours, cycles, sortie_ref)
select a.id,
       current_date - (d * 4 + a.idx),
       2.0 + ((d * 7 + a.idx * 3) % 30) / 10.0,
       1 + d % 2,
       'HIST-' || a.registration || '-' || d
from (select id, registration, row_number() over (order by registration)::int as idx from public.aircraft) a
cross join generate_series(1, 182) as d;   -- every 4 days, back ~2 years

alter table public.flight_logs enable trigger rollup;
