-- Step A polish.
--   1. Reopening (or cancelling) a completed work order that carried out a programme
--      task now undoes the compliance it recorded, restoring the task's previous
--      "last done" — unless another work order has recorded compliance since.
--   2. Audit trail indexes for the filtered views (by area, by user), so the trail
--      stays fast as it grows.
--   3. hermes_schema_checks(): lets Administration → System status show whether
--      migrations that add no table/column (0008, 0009) have been applied.
-- Run once in Supabase → SQL Editor after 0009.

-- 1 ─────────────────────────────────────────────────────────────────────────
-- Snapshot of the task's compliance before this work order completed it.
alter table public.work_orders
  add column task_snapshot    boolean not null default false,
  add column task_prev_date   date,
  add column task_prev_hours  numeric(10,1),
  add column task_prev_cycles integer;

-- Runs BEFORE so it can store the snapshot on the work order itself. Triggers fire
-- in name order, so "task_compliance" runs after "lifecycle" has set completed_at.
create or replace function public.work_order_task_compliance()
returns trigger language plpgsql as $$
declare
  t public.maintenance_tasks;
begin
  if new.task_id is null then return new; end if;

  -- Completing: remember the task's current compliance, then record this one.
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    select * into t from public.maintenance_tasks where id = new.task_id for update;
    if found then
      new.task_snapshot    := true;
      new.task_prev_date   := t.last_done_date;
      new.task_prev_hours  := t.last_done_hours;
      new.task_prev_cycles := t.last_done_cycles;

      update public.maintenance_tasks m
      set last_done_date   = new.completed_at,
          last_done_hours  = coalesce((select e.tsn from public.engines e where e.id = m.engine_id),
                                      (select a.total_hours from public.aircraft a where a.id = m.aircraft_id)),
          last_done_cycles = coalesce((select e.csn from public.engines e where e.id = m.engine_id),
                                      (select a.total_cycles from public.aircraft a where a.id = m.aircraft_id))
      where m.id = new.task_id;
    end if;

  -- Reopening or cancelling a completed work order: undo its compliance.
  elsif tg_op = 'UPDATE' and old.status = 'completed' and new.status <> 'completed' then
    if old.task_snapshot and old.task_id = new.task_id then
      if exists (
        select 1 from public.work_orders w
        where w.task_id = new.task_id and w.id <> new.id
          and w.status = 'completed' and w.completed_at >= old.completed_at
      ) then
        -- A later work order holds the current compliance. If its snapshot points at
        -- this one, hand it this one's snapshot so undoing it later skips this one.
        update public.work_orders w
        set task_prev_date   = old.task_prev_date,
            task_prev_hours  = old.task_prev_hours,
            task_prev_cycles = old.task_prev_cycles
        where w.task_id = new.task_id and w.id <> new.id
          and w.status = 'completed' and w.task_snapshot
          and w.task_prev_date is not distinct from old.completed_at;
      else
        update public.maintenance_tasks
        set last_done_date   = old.task_prev_date,
            last_done_hours  = old.task_prev_hours,
            last_done_cycles = old.task_prev_cycles
        where id = new.task_id and last_done_date is not distinct from old.completed_at;
      end if;
    end if;
    new.task_snapshot    := false;
    new.task_prev_date   := null;
    new.task_prev_hours  := null;
    new.task_prev_cycles := null;
  end if;
  return new;
end $$;

drop trigger complete_task on public.work_orders;
drop function public.work_order_complete_task();

create trigger task_compliance before insert or update of status on public.work_orders
  for each row execute function public.work_order_task_compliance();

-- 2 ─────────────────────────────────────────────────────────────────────────
create index if not exists audit_log_table_at on public.audit_log (table_name, at desc);
create index if not exists audit_log_actor_at on public.audit_log (actor, at desc);

-- 3 ─────────────────────────────────────────────────────────────────────────
create or replace function public.hermes_schema_checks()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    '0008', exists (select 1 from pg_catalog.pg_policies
                    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles self update'),
    '0009', exists (select 1 from pg_catalog.pg_trigger
                    where tgname = 'guard_status' and tgrelid = 'public.engines'::regclass),
    '0010', true
  )
$$;
revoke execute on function public.hermes_schema_checks() from public, anon;
grant execute on function public.hermes_schema_checks() to authenticated;
