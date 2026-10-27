-- Step 4: Health Monitoring. Raw condition-monitoring inputs per engine:
-- oil uplifts (consumption), oil samples (SOAP), chip detector checks and
-- borescope inspections. Each record resolves to a level: normal / caution / alert.
-- Run once in Supabase → SQL Editor after 0003.

-- Per-engine oil consumption limit (US qt per flight hour). Null = app default.
alter table public.engines add column oil_limit_qph numeric(5,2) check (oil_limit_qph > 0);

-- Oil uplift: oil added at servicing and the flight hours since the previous
-- servicing. Consumption rate = quantity / hours.
create table public.oil_uplifts (
  id            uuid primary key default gen_random_uuid(),
  engine_id     uuid not null references public.engines on delete cascade,
  serviced_at   date not null default current_date,
  quantity_qt   numeric(5,2) not null check (quantity_qt >= 0),
  flight_hours  numeric(7,1) not null check (flight_hours > 0),
  rate_qph      numeric(6,3) generated always as (round(quantity_qt / flight_hours, 3)) stored,
  notes         text,
  recorded_by   uuid references auth.users default auth.uid(),
  created_at    timestamptz not null default now()
);
create index on public.oil_uplifts (engine_id, serviced_at desc);

-- Spectrometric oil analysis (SOAP). Wear metals in ppm; the lab/engineer
-- interpretation is stored as the level.
create table public.oil_samples (
  id             uuid primary key default gen_random_uuid(),
  engine_id      uuid not null references public.engines on delete cascade,
  sampled_at     date not null default current_date,
  lab_ref        text,
  fe             numeric(6,1) check (fe >= 0),   -- iron
  cu             numeric(6,1) check (cu >= 0),   -- copper
  ag             numeric(6,1) check (ag >= 0),   -- silver
  mg             numeric(6,1) check (mg >= 0),   -- magnesium
  cr             numeric(6,1) check (cr >= 0),   -- chromium
  ni             numeric(6,1) check (ni >= 0),   -- nickel
  ti             numeric(6,1) check (ti >= 0),   -- titanium
  al             numeric(6,1) check (al >= 0),   -- aluminium
  level          text not null default 'normal' check (level in ('normal', 'caution', 'alert')),
  recommendation text,
  recorded_by    uuid references auth.users default auth.uid(),
  created_at     timestamptz not null default now()
);
create index on public.oil_samples (engine_id, sampled_at desc);

-- Chip detector checks. Level follows the worst debris found.
create table public.chip_checks (
  id           uuid primary key default gen_random_uuid(),
  engine_id    uuid not null references public.engines on delete cascade,
  checked_at   date not null default current_date,
  location     text not null,                 -- e.g. Reduction gearbox, Power section
  finding      text not null check (finding in ('clean', 'fuzz', 'fine_particles', 'flakes', 'chunks')),
  level        text generated always as (
    case finding when 'clean' then 'normal'
                 when 'fuzz' then 'normal'
                 when 'fine_particles' then 'caution'
                 else 'alert' end
  ) stored,
  action_taken text,
  recorded_by  uuid references auth.users default auth.uid(),
  created_at   timestamptz not null default now()
);
create index on public.chip_checks (engine_id, checked_at desc);

-- Borescope inspections. Level follows the disposition.
create table public.borescope_inspections (
  id           uuid primary key default gen_random_uuid(),
  engine_id    uuid not null references public.engines on delete cascade,
  inspected_at date not null default current_date,
  area         text not null,                 -- e.g. Turbine 1st stage, Combustor
  findings     text not null,
  disposition  text not null check (disposition in ('serviceable', 'monitor', 'reduced_interval', 'reject')),
  level        text generated always as (
    case disposition when 'serviceable' then 'normal'
                     when 'reject' then 'alert'
                     else 'caution' end
  ) stored,
  next_due     date,
  reference    text,                          -- task card / work order
  recorded_by  uuid references auth.users default auth.uid(),
  created_at   timestamptz not null default now()
);
create index on public.borescope_inspections (engine_id, inspected_at desc);

-- Audit trail + row-level security (same rules as health assessments).
do $$
declare t text;
begin
  foreach t in array array['oil_uplifts', 'oil_samples', 'chip_checks', 'borescope_inspections'] loop
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function public.audit()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s insert" on public.%I for insert to authenticated
                    with check (public.can_edit_engineering())', t, t);
    execute format('create policy "%s update" on public.%I for update to authenticated
                    using (public.can_edit_engineering()) with check (public.can_edit_engineering())', t, t);
    execute format('create policy "%s delete" on public.%I for delete to authenticated
                    using (public.current_user_role() = ''admin'')', t, t);
  end loop;
end $$;
