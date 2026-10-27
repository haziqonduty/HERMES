-- Optional SAMPLE data for Maintenance Planner, Work Management and Inventory (fictional).
-- Run once, after 0006_maintenance.sql. Adds:
--   • a maintenance programme: 5 tasks per installed engine + 3 per aircraft,
--     with last-compliance values spread so some are overdue or due soon
--   • 14 work orders (task cards, some linked to the sample defects and tasks)
--   • 20 store items with receipts and issues (a few below reorder level)

-- ─── Maintenance programme ──────────────────────────────────────────────────
insert into public.maintenance_tasks
  (engine_id, task_ref, title, ata_chapter, interval_hours, interval_days, last_done_date, last_done_hours)
select e.id, t.ref, t.title, t.ata, t.hrs, t.days,
       current_date - since.d,
       greatest(e.tsn - since.h, 0)
from public.engines e
join public.engine_installations i on i.engine_id = e.id and i.removed_at is null
cross join (values
  (1, 'ENG-79-001', 'Oil filter inspection and clean',          '79', 100.0,  null),
  (2, 'ENG-79-002', 'Chip detector inspection',                 '79', 50.0,   30),
  (3, 'ENG-72-003', 'Hot section borescope inspection',         '72', 600.0,  365),
  (4, 'ENG-73-004', 'Fuel nozzle flow check',                   '73', 1200.0, null),
  (5, 'ENG-74-005', 'Ignition exciter and igniter plug check',  '74', 400.0,  180)
) as t(k, ref, title, ata, hrs, days)
-- Hours flown since last done: 0–115% of the interval, so a few are overdue.
cross join lateral (
  select round((((substr(e.serial_number, 3)::int * 37 + t.k * 53) % 116) / 100.0) * t.hrs, 1) as h
) as fh
cross join lateral (
  select fh.h as h,
         least(coalesce(t.days, 9999), (fh.h / 0.9)::int)
           + case when t.days is not null and (substr(e.serial_number, 3)::int + t.k) % 9 = 0 then t.days / 6 else 0 end as d
) as since;

insert into public.maintenance_tasks
  (aircraft_id, task_ref, title, ata_chapter, interval_hours, interval_days, last_done_date, last_done_hours, last_done_cycles)
select a.id, t.ref, t.title, t.ata, t.hrs, t.days,
       current_date - ((a.idx * 23 + t.k * 11) % (t.days + t.days / 5)),
       a.total_hours - case when t.hrs is null then 0 else ((a.idx * 41 + t.k * 7) % 160) end,
       a.total_cycles
from (select id, total_hours, total_cycles, row_number() over (order by registration)::int as idx from public.aircraft) a
cross join (values
  (1, 'AC-05-001', 'Home station check',        '05', null::numeric, 30),
  (2, 'AC-05-002', 'Isochronal inspection',     '05', null,          180),
  (3, 'AC-32-003', 'Landing gear lubrication',  '32', 150.0,         90)
) as t(k, ref, title, ata, hrs, days);

-- ─── Store items ────────────────────────────────────────────────────────────
insert into public.parts (part_number, description, category, unit, min_quantity, location, applicability)
values
  ('6875432',     'Oil filter element',                        'consumable',    'ea', 12, 'Main store', 'T56-A-15'),
  ('6847215',     'Chip detector, magnetic',                   'component',     'ea', 4,  'Main store', 'T56-A-15'),
  ('6877013',     'Fuel nozzle assembly',                      'component',     'ea', 6,  'Main store', 'T56-A-15'),
  ('6843702',     'Igniter plug',                              'component',     'ea', 8,  'Main store', 'T56-A-15'),
  ('6890617',     'Ignition exciter',                          'component',     'ea', 2,  'Main store', 'T56-A-15'),
  ('6898450',     'Thermocouple harness',                      'component',     'ea', 2,  'Main store', 'T56-A-15'),
  ('6855190',     'Reduction gearbox carbon seal',             'component',     'ea', 3,  'Main store', 'T56-A-15'),
  ('MS29513-238', 'O-ring, packing',                           'hardware',      'ea', 50, 'Main store', 'General'),
  ('MS29513-152', 'O-ring, packing',                           'hardware',      'ea', 50, 'Main store', 'General'),
  ('AN6289-6',    'B-nut, flared tube',                        'hardware',      'ea', 20, 'Main store', 'General'),
  ('MIL-PRF-23699','Turbine engine oil (1 US qt)',             'consumable',    'qt', 96, 'POL store',  'T56-A-15'),
  ('MIL-PRF-81322','Wide-temperature grease',                  'consumable',    'kg', 4,  'POL store',  'General'),
  ('6872101',     'Fuel filter element',                       'consumable',    'ea', 10, 'Main store', 'T56-A-15'),
  ('6852433',     'Starter control valve',                     'component',     'ea', 1,  'Main store', 'T56-A-15'),
  ('6880990',     'Torquemeter shaft assembly',                'engine_module', 'ea', 1,  'Engine bay', 'T56-A-15'),
  ('6877110',     'Turbine 1st stage blade set',               'engine_module', 'set', 1, 'Engine bay', 'T56-A-15'),
  ('6863321',     'Oil cooler flange gasket',                  'hardware',      'ea', 6,  'Main store', 'T56-A-15'),
  ('BSI-6MM',     'Borescope probe, 6 mm articulating',        'tooling',       'ea', 1,  'Tool crib',  'General'),
  ('TQ-20-150',   'Torque wrench 20–150 in-lb (calibrated)',   'tooling',       'ea', 2,  'Tool crib',  'General'),
  ('6847999',     'Propeller balance weight kit',              'hardware',      'kit', 2, 'Main store', 'T56-A-15');

-- Opening balances (through the ledger so stock = sum of movements).
insert into public.stock_movements (part_id, moved_at, kind, quantity, reference, notes)
select p.id, current_date - 120, 'receipt', v.qty, 'GRN-OPENING', 'Opening balance'
from public.parts p
join (values
  ('6875432', 30), ('6847215', 6), ('6877013', 4), ('6843702', 16), ('6890617', 2),
  ('6898450', 1),  ('6855190', 5), ('MS29513-238', 120), ('MS29513-152', 80), ('AN6289-6', 40),
  ('MIL-PRF-23699', 240), ('MIL-PRF-81322', 6), ('6872101', 12), ('6852433', 1), ('6880990', 1),
  ('6877110', 1), ('6863321', 4), ('BSI-6MM', 1), ('TQ-20-150', 2), ('6847999', 3)
) as v(pn, qty) on v.pn = p.part_number;

-- ─── Work orders (oldest first so numbers follow dates) ─────────────────────
insert into public.work_orders
  (title, description, kind, priority, status, aircraft_id, engine_id, defect_id, due_date,
   assigned_to, est_hours, actual_hours, started_at, completed_at, completion_notes, created_at)
select w.title, w.descr, w.kind, w.priority, w.status, a.id, e.id, d.id,
       current_date + w.due, w.team, w.est, w.act,
       case when w.status in ('in_progress', 'awaiting_parts', 'completed') then current_date - w.age + 1 end,
       case when w.status = 'completed' then current_date - w.age + 3 end,
       w.notes,
       now() - make_interval(days => w.age)
from (values
  (60, 'Replace thermocouple harness — TIT fluctuation',     null, 'unscheduled', 'urgent',  'completed',      'M30-03', 'AE451211', null, -55, 'Engine shop',   6.0, 7.5,  'Harness replaced, ground run satisfactory.'),
  (52, 'Propeller dynamic balance',                          null, 'unscheduled', 'routine', 'completed',      'M30-04', 'AE451214', null, -45, 'Propeller shop', 4.0, 3.5,  'Balanced to 0.08 IPS.'),
  (44, 'Fuel filter replacement — bypass indication',        null, 'unscheduled', 'urgent',  'completed',      'M30-02', 'AE451206', null, -40, 'Engine shop',   2.0, 2.0,  'Filter replaced, fuel sample clear.'),
  (35, 'Torque indication troubleshooting',                  null, 'unscheduled', 'routine', 'completed',      'M30-05', 'AE451218', null, -30, 'Avionics',      3.0, 4.0,  'Connector cleaned and resealed.'),
  (28, 'SB 72-1094 compressor module inspection',            'Service bulletin compliance', 'modification', 'routine', 'planned', 'M30-01', 'AE451202', null, 30, 'Engine shop', 16.0, null, null),
  (21, 'Oil leak at reduction gearbox scavenge line',        null, 'unscheduled', 'routine', 'cancelled',      'M30-06', 'AE451222', null, -14, 'Engine shop',   2.0, null, 'Duplicate of an existing work order.'),
  (14, 'Borescope hot section — follow-up on blade erosion',  null, 'inspection', 'routine', 'planned',        'M30-05', 'AE451219', 'Borescope: minor erosion turbine 1st stage blade', 7, 'NDT', 3.0, null, null),
  (9,  'Investigate high oil consumption',                   'Leak check, oil system inspection, SOAP sample.', 'unscheduled', 'aog', 'awaiting_parts', 'M30-02', 'AE451207', 'Oil consumption trending high — 0.9 qt/hr', 0, 'Engine shop', 8.0, 5.0, null),
  (8,  'Chip detector findings — inspect and sample',        null, 'unscheduled', 'urgent',  'in_progress',    'M30-01', 'AE451203', 'Chip detector — fine ferrous particles found', 2, 'Engine shop', 4.0, 1.5, null),
  (6,  'RGB vibration troubleshooting',                      null, 'unscheduled', 'urgent',  'in_progress',    'M30-04', 'AE451213', 'Vibration exceedance on reduction gearbox', 3, 'Engine shop', 6.0, 3.0, null),
  (5,  'Nose gear steering actuator — replace seals',        null, 'unscheduled', 'urgent',  'open',           'M30-06', null,       'Nose gear steering actuator leak', 4, 'Airframe', 5.0, null, null),
  (3,  'Pre-deployment engine ground runs',                  null, 'inspection',  'routine', 'open',           'M30-03', null,       null, 10, 'Line',         4.0, null, null),
  (2,  'Igniter plug replacement — No.3 engine',             null, 'scheduled',   'routine', 'open',           'M30-05', 'AE451219', null, 12, 'Engine shop',   2.0, null, null),
  (1,  'Oil cooler flange gasket replacement',               null, 'unscheduled', 'routine', 'planned',        'M30-02', 'AE451208', null, 21, 'Engine shop',   3.0, null, null)
) as w(age, title, descr, kind, priority, status, reg, sn, defect, due, team, est, act, notes)
join public.aircraft a on a.registration = w.reg
left join public.engines e on e.serial_number = w.sn
left join public.defects d on d.description = w.defect
order by w.age desc;

-- Two scheduled work orders raised from overdue / due programme tasks.
insert into public.work_orders (title, kind, priority, status, aircraft_id, engine_id, task_id, due_date, assigned_to, est_hours)
select t.title || ' — ' || e.serial_number, 'scheduled', 'routine', 'planned', i.aircraft_id, e.id, t.id,
       current_date + 5, 'Engine shop', 1.5
from public.maintenance_tasks t
join public.engines e on e.id = t.engine_id
join public.engine_installations i on i.engine_id = e.id and i.removed_at is null
where t.task_ref = 'ENG-79-002'
order by t.last_done_hours + t.interval_hours - e.tsn
limit 2;

-- Task-card steps for the active work orders.
insert into public.work_order_steps (work_order_id, seq, instruction, done)
select w.id, s.seq, s.instruction, s.seq <= case w.status when 'in_progress' then 2 when 'awaiting_parts' then 3 else 0 end
from public.work_orders w
cross join (values
  (1, 'Open engine cowlings and make the area safe'),
  (2, 'Carry out inspection per task card and record findings'),
  (3, 'Raise demand for any parts required'),
  (4, 'Rectify / replace components as required'),
  (5, 'Ground run, leak check and close cowlings')
) as s(seq, instruction)
where w.status in ('open', 'in_progress', 'awaiting_parts');

-- Parts issued to work orders.
insert into public.stock_movements (part_id, moved_at, kind, quantity, work_order_id, reference)
select p.id, coalesce(w.completed_at, current_date - 1), 'issue', -v.qty, w.id, 'DEMAND-' || w.wo_no
from (values
  ('Replace thermocouple harness — TIT fluctuation', '6898450', 1),
  ('Fuel filter replacement — bypass indication',    '6872101', 2),
  ('Propeller dynamic balance',                      '6847999', 1),
  ('Investigate high oil consumption',               'MIL-PRF-23699', 24),
  ('Investigate high oil consumption',               'MS29513-238', 6),
  ('Chip detector findings — inspect and sample',    '6847215', 1),
  ('Chip detector findings — inspect and sample',    '6875432', 2)
) as v(title, pn, qty)
join public.work_orders w on w.title = v.title
join public.parts p on p.part_number = v.pn;

-- Routine consumable draw over the last quarter (puts a few items below reorder level).
insert into public.stock_movements (part_id, moved_at, kind, quantity, reference, notes)
select p.id, current_date - v.age, 'issue', -v.qty, 'LINE-' || v.age, 'Line servicing'
from (values
  ('6875432', 90, 8), ('6875432', 45, 9), ('MIL-PRF-23699', 80, 60), ('MIL-PRF-23699', 30, 72),
  ('6843702', 60, 6), ('6872101', 20, 3), ('MS29513-152', 50, 34), ('6863321', 10, 1)
) as v(pn, age, qty)
join public.parts p on p.part_number = v.pn;
