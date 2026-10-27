import "server-only";
import { WO_ACTIVE, taskDue, type MaintenanceTask, type TaskDue } from "./maintenance";
import type { createClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Utilisation is averaged over this many days of flight logs. */
export const UTILISATION_DAYS = 90;

type TaskRow = MaintenanceTask & {
  engines: {
    serial_number: string;
    tsn: number;
    csn: number;
    engine_installations: { aircraft_id: string; removed_at: string | null; aircraft: { registration: string } | null }[];
  } | null;
  aircraft: { registration: string; total_hours: number; total_cycles: number } | null;
};

export type PlannedTask = MaintenanceTask & {
  asset: string;
  assetHref: string;
  /** Aircraft the task's asset is on (for engines: where it is fitted). */
  aircraftReg: string | null;
  due: TaskDue;
  openWo: { id: string; wo_no: string | null } | null;
};

export type OverhaulForecast = {
  serial_number: string;
  location: string;
  tso: number;
  interval: number;
  remaining: number;
  dueDate: string | null;
};

export type Rates = Map<string, { hoursPerDay: number; cyclesPerDay: number }>;

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + Math.round(d) * 86_400_000).toISOString().slice(0, 10);

/** Average flight hours and cycles per day for each aircraft over the last UTILISATION_DAYS. */
export async function loadRates(supabase: Supabase, today: string): Promise<Rates> {
  const since = addDays(today, -UTILISATION_DAYS);
  const { data } = await supabase.from("flight_logs").select("aircraft_id, flight_hours, cycles").gte("flight_date", since).limit(10000);
  const rates: Rates = new Map();
  for (const f of data ?? []) {
    const r = rates.get(f.aircraft_id) ?? { hoursPerDay: 0, cyclesPerDay: 0 };
    r.hoursPerDay += Number(f.flight_hours) / UTILISATION_DAYS;
    r.cyclesPerDay += Number(f.cycles) / UTILISATION_DAYS;
    rates.set(f.aircraft_id, r);
  }
  return rates;
}

/** The maintenance programme with next-due projections. Null if 0006 hasn't been applied. */
export async function loadPlanner(
  supabase: Supabase,
  today: string,
  opts: { taskId?: string; engineId?: string; aircraftId?: string; includeInactive?: boolean } = {},
): Promise<{ tasks: PlannedTask[]; rates: Rates } | null> {
  let query = supabase
    .from("maintenance_tasks")
    .select(
      "*, engines(serial_number, tsn, csn, engine_installations(aircraft_id, removed_at, aircraft(registration))), aircraft(registration, total_hours, total_cycles)",
    )
    .limit(2000);
  if (!opts.includeInactive) query = query.eq("active", true);
  if (opts.taskId) query = query.eq("id", opts.taskId);
  if (opts.engineId) query = query.eq("engine_id", opts.engineId);
  if (opts.aircraftId) query = query.eq("aircraft_id", opts.aircraftId);

  const [tasksRes, rates, wosRes] = await Promise.all([
    query.returns<TaskRow[]>(),
    loadRates(supabase, today),
    supabase.from("work_orders").select("id, wo_no, task_id").not("task_id", "is", null).in("status", WO_ACTIVE),
  ]);
  if (tasksRes.error) return null;

  const openWo = new Map((wosRes.data ?? []).map((w) => [w.task_id as string, { id: w.id as string, wo_no: w.wo_no as string | null }]));
  const none = { hoursPerDay: 0, cyclesPerDay: 0 };

  const tasks = (tasksRes.data ?? []).map(({ engines: e, aircraft: a, ...t }) => {
    const fitted = e?.engine_installations.find((i) => !i.removed_at);
    const aircraftId = e ? fitted?.aircraft_id : t.aircraft_id;
    const life = e ? { hours: Number(e.tsn), cycles: e.csn } : { hours: Number(a?.total_hours ?? 0), cycles: a?.total_cycles ?? 0 };
    return {
      ...t,
      asset: e ? e.serial_number : (a?.registration ?? "—"),
      assetHref: e ? `/engines/${encodeURIComponent(e.serial_number)}` : `/fleet/${encodeURIComponent(a?.registration ?? "")}`,
      aircraftReg: e ? (fitted?.aircraft?.registration ?? null) : (a?.registration ?? null),
      due: taskDue(t, life, (aircraftId && rates.get(aircraftId)) || none, today),
      openWo: openWo.get(t.id) ?? null,
    } satisfies PlannedTask;
  });

  const order = { overdue: 0, due_soon: 1, ok: 2, no_baseline: 3 };
  tasks.sort((x, y) => order[x.due.state] - order[y.due.state] || (x.due.dueDate ?? "9999").localeCompare(y.due.dueDate ?? "9999"));
  return { tasks, rates };
}

type EngineRow = {
  serial_number: string;
  status: string;
  tso: number | null;
  overhaul_interval_hours: number | null;
  engine_installations: { aircraft_id: string; removed_at: string | null; position: number; aircraft: { registration: string } | null }[];
};

/** Engines ranked by hours to overhaul, with a projected date from their aircraft's utilisation. */
export async function loadOverhaulForecast(supabase: Supabase, rates: Rates, today: string): Promise<OverhaulForecast[]> {
  const { data } = await supabase
    .from("engines")
    .select("serial_number, status, tso, overhaul_interval_hours, engine_installations(aircraft_id, removed_at, position, aircraft(registration))")
    .neq("status", "retired")
    .neq("status", "in_overhaul")
    .returns<EngineRow[]>();
  return (data ?? [])
    .filter((e) => e.tso != null && e.overhaul_interval_hours)
    .map((e) => {
      const fitted = e.engine_installations.find((i) => !i.removed_at);
      const remaining = Number(e.overhaul_interval_hours) - Number(e.tso);
      const perDay = fitted ? (rates.get(fitted.aircraft_id)?.hoursPerDay ?? 0) : 0;
      return {
        serial_number: e.serial_number,
        location: fitted?.aircraft ? `${fitted.aircraft.registration} #${fitted.position}` : "Store",
        tso: Number(e.tso),
        interval: Number(e.overhaul_interval_hours),
        remaining,
        dueDate: perDay > 0 ? addDays(today, remaining / perDay) : remaining <= 0 ? today : null,
      };
    })
    .sort((a, b) => a.remaining - b.remaining);
}
