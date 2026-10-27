-- Step 3: Engine Health Index (EHI). Each assessment scores six engine
-- components 0–100; the EHI is calculated from them, and the engine's current
-- EHI always follows its latest assessment.
-- Run once in Supabase → SQL Editor after 0002.

create table public.ehi_assessments (
  id           uuid primary key default gen_random_uuid(),
  engine_id    uuid not null references public.engines on delete cascade,
  assessed_at  date not null default current_date,
  vibration    smallint not null check (vibration   between 0 and 100),
  oil_system   smallint not null check (oil_system  between 0 and 100),
  hot_section  smallint not null check (hot_section between 0 and 100),
  compressor   smallint not null check (compressor  between 0 and 100),
  fuel_system  smallint not null check (fuel_system between 0 and 100),
  accessories  smallint not null check (accessories between 0 and 100),
  -- Weighted score (vibration/oil/hot section 20% each, compressor/accessories 15%,
  -- fuel 10%), capped at worst component + 25 so one failing system can't hide
  -- behind healthy ones.
  ehi smallint generated always as (
    least(
      round((vibration * 20 + oil_system * 20 + hot_section * 20
           + compressor * 15 + fuel_system * 10 + accessories * 15) / 100.0),
      least(vibration, oil_system, hot_section, compressor, fuel_system, accessories) + 25
    )::smallint
  ) stored,
  source       text,            -- e.g. Oil analysis, Borescope, Ground run
  notes        text,
  assessed_by  uuid references auth.users default auth.uid(),
  created_at   timestamptz not null default now()
);
create index on public.ehi_assessments (engine_id, assessed_at desc);
create index on public.ehi_assessments (assessed_at);

-- Keep engines.ehi equal to the latest assessment.
create or replace function public.sync_engine_ehi()
returns trigger language plpgsql set search_path = '' as $$
declare v_engine uuid;
begin
  if tg_op = 'DELETE' then v_engine := old.engine_id; else v_engine := new.engine_id; end if;

  update public.engines
  set ehi = (
    select a.ehi from public.ehi_assessments a
    where a.engine_id = v_engine
    order by a.assessed_at desc, a.created_at desc
    limit 1
  )
  where id = v_engine;
  return null;
end $$;

create trigger sync_ehi after insert or update or delete on public.ehi_assessments
  for each row execute function public.sync_engine_ehi();

create trigger audit after insert or update or delete on public.ehi_assessments
  for each row execute function public.audit();

alter table public.ehi_assessments enable row level security;
create policy "ehi read"   on public.ehi_assessments for select to authenticated using (true);
create policy "ehi insert" on public.ehi_assessments for insert to authenticated with check (public.can_edit_engineering());
create policy "ehi update" on public.ehi_assessments for update to authenticated using (public.can_edit_engineering()) with check (public.can_edit_engineering());
create policy "ehi delete" on public.ehi_assessments for delete to authenticated using (public.current_user_role() = 'admin');

-- Baseline: turn each engine's existing manual EHI into a first assessment so
-- nothing is lost (all components set to the existing value → same EHI).
insert into public.ehi_assessments
  (engine_id, assessed_at, vibration, oil_system, hot_section, compressor, fuel_system, accessories, source, notes)
select id, current_date, ehi, ehi, ehi, ehi, ehi, ehi, 'Baseline', 'Migrated from manual EHI entry'
from public.engines
where ehi is not null;
