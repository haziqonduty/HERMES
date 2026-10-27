-- Optional SAMPLE data: 11 months of monthly EHI assessments for the sample
-- engines (AE451201–AE451227) so the trend charts have history.
-- Run after 0003_engine_health_index.sql. Fictional values.

insert into public.ehi_assessments
  (engine_id, assessed_at, vibration, oil_system, hot_section, compressor, fuel_system, accessories, source)
select
  e.id,
  (current_date - make_interval(months => m))::date,
  -- Health was better in the past: engines that are weak today declined faster.
  least(100, b.base + m * b.rate + (n * 7 + m * 3) % 9  - 4),
  least(100, b.base + m * b.rate + (n * 5 + m * 7) % 11 - 6),
  least(100, b.base + m * b.rate + (n * 3 + m * 5) % 7  - 3),
  least(100, b.base + m * b.rate + (n * 11 + m) % 9     - 2),
  least(100, b.base + m * b.rate + (n + m * 2) % 7      - 1),
  least(100, b.base + m * b.rate + (n * 13 + m * 3) % 9 - 3),
  (array['Oil analysis', 'Ground run', 'Borescope', 'Vibration survey'])[1 + (n + m) % 4]
from public.engines e
cross join lateral (select substring(e.serial_number from 3)::int - 451200 as n) s
cross join lateral (select e.ehi as base, case when e.ehi < 60 then 3 else 1 end as rate) b
cross join generate_series(1, 11) as m
where e.serial_number like 'AE4512%' and e.ehi is not null;
