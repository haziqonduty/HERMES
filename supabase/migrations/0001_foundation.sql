-- HERMES foundation schema: users & roles, aircraft, engines, installations,
-- flight logs, defects, audit trail. Run once in Supabase → SQL Editor.

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.user_role as enum
  ('admin', 'oc_engineering', 'commander', 'supervisor', 'planner', 'engineer', 'viewer');
create type public.aircraft_status as enum
  ('serviceable', 'standby', 'in_maintenance', 'unserviceable');
create type public.engine_status as enum
  ('installed', 'spare', 'in_overhaul', 'unserviceable', 'retired');
create type public.defect_severity as enum ('minor', 'major', 'critical');
create type public.defect_status as enum ('open', 'in_work', 'deferred', 'closed');

-- ─── Profiles (one per auth user) ───────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  rank        text,
  service_no  text,
  squadron    text,
  role        public.user_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role of the signed-in user (security definer avoids RLS recursion on profiles).
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_edit_engineering()
returns boolean language sql stable as $$
  select coalesce(public.current_user_role() in
    ('admin', 'oc_engineering', 'supervisor', 'planner', 'engineer'), false)
$$;

-- ─── Fleet ──────────────────────────────────────────────────────────────────
create table public.aircraft (
  id             uuid primary key default gen_random_uuid(),
  registration   text not null unique,          -- tail number, e.g. M30-01
  aircraft_type  text not null,                 -- e.g. C-130H, EC725
  serial_number  text,
  squadron       text,
  base           text,
  status         public.aircraft_status not null default 'serviceable',
  total_hours    numeric(10,1) not null default 0 check (total_hours >= 0),
  total_cycles   integer not null default 0 check (total_cycles >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.engines (
  id                       uuid primary key default gen_random_uuid(),
  serial_number            text not null unique,
  model                    text not null,       -- e.g. T56-A-15
  manufacturer             text,
  status                   public.engine_status not null default 'spare',
  tsn                      numeric(10,1) not null default 0 check (tsn >= 0),  -- time since new (FH)
  csn                      integer not null default 0 check (csn >= 0),       -- cycles since new
  tso                      numeric(10,1) check (tso >= 0),                   -- time since overhaul (FH)
  cso                      integer check (cso >= 0),
  overhaul_interval_hours  numeric(10,1) check (overhaul_interval_hours > 0),
  last_overhaul_date       date,
  ehi                      smallint check (ehi between 0 and 100),          -- Engine Health Index
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.engine_installations (
  id              uuid primary key default gen_random_uuid(),
  engine_id       uuid not null references public.engines on delete cascade,
  aircraft_id     uuid not null references public.aircraft on delete cascade,
  position        smallint not null check (position between 1 and 8),
  installed_at    date not null,
  removed_at      date,
  removal_reason  text,
  created_at      timestamptz not null default now(),
  check (removed_at is null or removed_at >= installed_at)
);
-- An engine can be fitted in only one place, and a position holds one engine.
create unique index engine_installations_active_engine
  on public.engine_installations (engine_id) where removed_at is null;
create unique index engine_installations_active_position
  on public.engine_installations (aircraft_id, position) where removed_at is null;

create table public.flight_logs (
  id            uuid primary key default gen_random_uuid(),
  aircraft_id   uuid not null references public.aircraft on delete cascade,
  flight_date   date not null,
  flight_hours  numeric(6,1) not null check (flight_hours > 0),
  cycles        integer not null default 1 check (cycles >= 0),
  sortie_ref    text,
  created_by    uuid references auth.users default auth.uid(),
  created_at    timestamptz not null default now()
);
create index on public.flight_logs (aircraft_id, flight_date desc);

create table public.defects (
  id            uuid primary key default gen_random_uuid(),
  aircraft_id   uuid references public.aircraft on delete set null,
  engine_id     uuid references public.engines on delete set null,
  reported_at   date not null default current_date,
  ata_chapter   text,
  system        text,
  description   text not null,
  severity      public.defect_severity not null default 'minor',
  status        public.defect_status not null default 'open',
  action_taken  text,
  closed_at     date,
  reported_by   uuid references auth.users default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (aircraft_id is not null or engine_id is not null)
);
create index on public.defects (status, reported_at desc);

-- ─── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch before update on public.aircraft for each row execute function public.touch_updated_at();
create trigger touch before update on public.engines  for each row execute function public.touch_updated_at();
create trigger touch before update on public.defects  for each row execute function public.touch_updated_at();

-- ─── Audit trail ────────────────────────────────────────────────────────────
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  actor       uuid default auth.uid(),
  at          timestamptz not null default now()
);
create index on public.audit_log (table_name, record_id);
create index on public.audit_log (at desc);

create or replace function public.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, new_data)
    values (tg_table_name, new.id, tg_op, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_data, new_data)
    values (tg_table_name, new.id, tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (table_name, record_id, action, old_data)
    values (tg_table_name, old.id, tg_op, to_jsonb(old));
    return old;
  end if;
end $$;

create trigger audit after insert or update or delete on public.profiles             for each row execute function public.audit();
create trigger audit after insert or update or delete on public.aircraft             for each row execute function public.audit();
create trigger audit after insert or update or delete on public.engines              for each row execute function public.audit();
create trigger audit after insert or update or delete on public.engine_installations for each row execute function public.audit();
create trigger audit after insert or update or delete on public.flight_logs          for each row execute function public.audit();
create trigger audit after insert or update or delete on public.defects              for each row execute function public.audit();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.aircraft             enable row level security;
alter table public.engines              enable row level security;
alter table public.engine_installations enable row level security;
alter table public.flight_logs          enable row level security;
alter table public.defects              enable row level security;
alter table public.audit_log            enable row level security;

-- Profiles: everyone signed in can see colleagues; only admins change roles.
create policy "profiles read" on public.profiles
  for select to authenticated using (true);
create policy "profiles admin write" on public.profiles
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Engineering data: all signed-in users read; engineering roles write; admins delete.
do $$
declare t text;
begin
  foreach t in array array['aircraft', 'engines', 'engine_installations', 'flight_logs', 'defects'] loop
    execute format('create policy "%1$s read" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s insert" on public.%1$I for insert to authenticated with check (public.can_edit_engineering())', t);
    execute format('create policy "%1$s update" on public.%1$I for update to authenticated using (public.can_edit_engineering()) with check (public.can_edit_engineering())', t);
    execute format('create policy "%1$s delete" on public.%1$I for delete to authenticated using (public.current_user_role() = ''admin'')', t);
  end loop;
end $$;

-- Audit log: read-only, for admins and OC Engineering. Rows are written only by the trigger.
create policy "audit read" on public.audit_log
  for select to authenticated
  using (public.current_user_role() in ('admin', 'oc_engineering'));
