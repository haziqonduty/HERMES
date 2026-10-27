-- Optional SAMPLE data for demos. Run after 0001_foundation.sql.
-- Fictional values: 6 four-engine transports, 24 installed engines + 3 spares.

insert into public.aircraft (registration, aircraft_type, squadron, base, status, total_hours, total_cycles)
values
  ('M30-01', 'C-130H', 'No. 20 Squadron', 'Subang', 'serviceable',    24510.4, 15220),
  ('M30-02', 'C-130H', 'No. 20 Squadron', 'Subang', 'serviceable',    23988.0, 14870),
  ('M30-03', 'C-130H', 'No. 20 Squadron', 'Subang', 'in_maintenance', 25102.7, 15904),
  ('M30-04', 'C-130H', 'No. 20 Squadron', 'Subang', 'serviceable',    22740.2, 14011),
  ('M30-05', 'C-130H', 'No. 20 Squadron', 'Subang', 'standby',        24033.9, 15130),
  ('M30-06', 'C-130H', 'No. 20 Squadron', 'Subang', 'unserviceable',  26011.5, 16402);

-- 27 engines with deterministic pseudo-random hours and health.
insert into public.engines (serial_number, model, manufacturer, status, tsn, csn, tso, cso,
                            overhaul_interval_hours, last_overhaul_date, ehi)
select
  'AE' || (451200 + n),
  'T56-A-15',
  'Rolls-Royce (Allison)',
  case when n <= 24 then 'installed' else 'spare' end::public.engine_status,
  18000 + (n * 937) % 9000,
  11000 + (n * 613) % 6000,
  (n * 389) % 4000,
  (n * 251) % 2600,
  4000,
  current_date - ((n * 47) % 900),
  case n when 7 then 42 when 13 then 48 when 3 then 55 when 19 then 58 else 64 + (n * 17) % 34 end
from generate_series(1, 27) as n;

-- Fit engines 1–24 into positions 1–4 of each aircraft.
insert into public.engine_installations (engine_id, aircraft_id, position, installed_at)
select e.id, a.id, ((n - 1) % 4) + 1, current_date - ((n * 61) % 1400)
from generate_series(1, 24) as n
join public.engines e on e.serial_number = 'AE' || (451200 + n)
join public.aircraft a on a.registration = 'M30-0' || (((n - 1) / 4) + 1);

insert into public.defects (aircraft_id, engine_id, reported_at, ata_chapter, system, description, severity, status)
select a.id, e.id, current_date - d.age, d.ata, d.sys, d.descr, d.sev::public.defect_severity, d.st::public.defect_status
from (values
  ('M30-02', 'AE451207', 2,  '79', 'Oil',        'Oil consumption trending high — 0.9 qt/hr',       'critical', 'open'),
  ('M30-04', 'AE451213', 5,  '72', 'Engine',     'Vibration exceedance on reduction gearbox',       'major',    'in_work'),
  ('M30-01', 'AE451203', 9,  '79', 'Oil',        'Chip detector — fine ferrous particles found',     'major',    'open'),
  ('M30-05', 'AE451219', 14, '72', 'Hot section','Borescope: minor erosion turbine 1st stage blade', 'minor',    'deferred'),
  ('M30-06', null,       20, '32', 'Landing gear','Nose gear steering actuator leak',               'major',    'open')
) as d(reg, sn, age, ata, sys, descr, sev, st)
join public.aircraft a on a.registration = d.reg
left join public.engines e on e.serial_number = d.sn;
