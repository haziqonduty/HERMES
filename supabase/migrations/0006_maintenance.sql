-- Step 6: Maintenance Planner, Work Management and Inventory.
--   • maintenance_tasks  — the maintenance programme: repeating tasks per engine or aircraft
--                          with hour / cycle / calendar intervals and the last compliance
--   • work_orders        — WO-YY-NNNN, linked to a task, a defect, an aircraft and/or an engine.
--                          Completing a WO that is linked to a task records the compliance.
--   • work_order_steps   — task-card steps, signed off one by one
--   • parts / stock_movements — store stock; every movement updates the on-hand quantity
-- Run once in Supabase → SQL Editor after 0005.

-- ─── Maintenance programme ──────────────────────────────────────────────────
create table public.maintenance_tasks (
  id               uuid primary key default gen_random_uuid(),
  engine_id        uuid references public.engines on delete cascade,
  aircraft_id      uuid references public.aircraft on delete cascade,
  task_ref         text,                       -- task card / programme reference
  title            text not null,
  ata_chapter      text,
  interval_hours   numeric(8,1) check (interval_hours > 0),
  interval_cycles  integer check (interval_cycles > 0),
  interval_days    integer check (interval_days > 0),
  -- Last compliance. Hours/cycles are the asset's life counter at the time
  -- (engine TSN/CSN, or aircraft total hours/cycles).
  last_done_date   date,
  last_done_hours  numeric(10,1) check (last_done_hours >= 0),
  last_done_cycles integer check (last_done_cycles >= 0),
  active           boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (num_nonnulls(engine_id, aircraft_id) = 1),
  check (num_nonnulls(interval_hours, interval_cycles, interval_days) > 0)
);
create index on public.maintenance_tasks (engine_id);
create index on public.maintenance_tasks (aircraft_id);

-- ─── Work orders ────────────────────────────────────────────────────────────
create sequence public.work_order_no_seq;

create table public.work_orders (
  id               uuid primary key default gen_random_uuid(),
  wo_no            text unique,                -- WO-YY-NNNN, assigned by trigger
  title            text not null,
  description      text,
  kind             text not null default 'unscheduled'
                   check (kind in ('scheduled', 'unscheduled', 'inspection', 'modification')),
  priority         text not null default 'routine' check (priority in ('routine', 'urgent', 'aog')),
  status           text not null default 'open'
                   check (status in ('planned', 'open', 'in_progress', 'awaiting_parts', 'completed', 'cancelled')),
  aircraft_id      uuid references public.aircraft on delete set null,
  engine_id        uuid references public.engines on delete set null,
  defect_id        uuid references public.defects on delete set null,
  task_id          uuid references public.maintenance_tasks on delete set null,
  due_date         date,
  assigned_to      text,                       -- trade / team / tradesman
  est_hours        numeric(6,1) check (est_hours >= 0),     -- man-hours
  actual_hours     numeric(6,1) check (actual_hours >= 0),
  started_at       date,
  completed_at     date,
  completion_notes text,
  raised_by        uuid references auth.users default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.work_orders (status, due_date);
create index on public.work_orders (task_id);
create index on public.work_orders (defect_id);

-- Numbering and status dates.
create or replace function public.work_order_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.wo_no is null then
    new.wo_no := 'WO-' || to_char(current_date, 'YY') || '-' || lpad(nextval('public.work_order_no_seq')::text, 4, '0');
  end if;
  if new.status in ('in_progress', 'awaiting_parts', 'completed') then
    new.started_at := coalesce(new.started_at, current_date);
  end if;
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, current_date);
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger lifecycle before insert or update on public.work_orders
  for each row execute function public.work_order_lifecycle();
create trigger touch before update on public.work_orders
  for each row execute function public.touch_updated_at();

-- Completing a work order that carries out a programme task records the
-- compliance against the asset's current life counters.
create or replace function public.work_order_complete_task()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and new.task_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update public.maintenance_tasks t
    set last_done_date   = new.completed_at,
        last_done_hours  = coalesce((select e.tsn from public.engines e where e.id = t.engine_id),
                                    (select a.total_hours from public.aircraft a where a.id = t.aircraft_id)),
        last_done_cycles = coalesce((select e.csn from public.engines e where e.id = t.engine_id),
                                    (select a.total_cycles from public.aircraft a where a.id = t.aircraft_id))
    where t.id = new.task_id;
  end if;
  return new;
end $$;

create trigger complete_task after insert or update of status on public.work_orders
  for each row execute function public.work_order_complete_task();

-- Task-card steps. Sign-off stamps who and when.
create table public.work_order_steps (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders on delete cascade,
  seq            integer not null,
  instruction    text not null,
  done           boolean not null default false,
  done_by        uuid references public.profiles,
  done_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index on public.work_order_steps (work_order_id, seq);

create or replace function public.work_order_step_signoff()
returns trigger language plpgsql as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end $$;

create trigger signoff before insert or update on public.work_order_steps
  for each row execute function public.work_order_step_signoff();

-- ─── Inventory ──────────────────────────────────────────────────────────────
create table public.parts (
  id             uuid primary key default gen_random_uuid(),
  part_number    text not null,
  description    text not null,
  category       text not null default 'component'
                 check (category in ('engine_module', 'component', 'consumable', 'hardware', 'tooling')),
  unit           text not null default 'ea',
  quantity       numeric(10,2) not null default 0 check (quantity >= 0),   -- maintained by stock_movements
  min_quantity   numeric(10,2) not null default 0 check (min_quantity >= 0), -- reorder level
  location       text not null default 'Main store',
  applicability  text,                        -- e.g. T56-A-15
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (part_number, location)
);
create trigger touch before update on public.parts
  for each row execute function public.touch_updated_at();

-- Signed quantity: receipts and returns add stock, issues remove it,
-- adjustments can go either way.
create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  part_id        uuid not null references public.parts on delete cascade,
  moved_at       date not null default current_date,
  kind           text not null check (kind in ('receipt', 'issue', 'return', 'adjustment')),
  quantity       numeric(10,2) not null check (quantity <> 0),
  work_order_id  uuid references public.work_orders on delete set null,
  reference      text,                        -- GRN, demand no., etc.
  notes          text,
  recorded_by    uuid references auth.users default auth.uid(),
  created_at     timestamptz not null default now(),
  check (case kind when 'issue' then quantity < 0
                   when 'adjustment' then true
                   else quantity > 0 end)
);
create index on public.stock_movements (part_id, moved_at desc);
create index on public.stock_movements (work_order_id);

create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
declare on_hand numeric;
begin
  if tg_op = 'INSERT' then
    select quantity into on_hand from public.parts where id = new.part_id for update;
    if on_hand + new.quantity < 0 then
      raise exception 'Not enough stock — only % on hand.', on_hand;
    end if;
    update public.parts set quantity = quantity + new.quantity where id = new.part_id;
    return new;
  else
    update public.parts set quantity = greatest(quantity - old.quantity, 0) where id = old.part_id;
    return old;
  end if;
end $$;

create trigger apply after insert or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ─── Audit trail + row-level security ───────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['maintenance_tasks', 'work_orders', 'work_order_steps', 'parts', 'stock_movements'] loop
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

-- Stock movements are a ledger: correct a mistake with an adjustment, never by editing.
drop policy "stock_movements update" on public.stock_movements;
