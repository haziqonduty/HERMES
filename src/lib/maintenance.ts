import type { StatusMeta } from "./status";

// ─── Work orders ────────────────────────────────────────────────────────────
export const woStatus: Record<string, StatusMeta> = {
  planned: { label: "Planned", color: "var(--muted)" },
  open: { label: "Open", color: "var(--accent)" },
  in_progress: { label: "In progress", color: "var(--gold)" },
  awaiting_parts: { label: "Awaiting parts", color: "var(--warning)" },
  completed: { label: "Completed", color: "var(--success)" },
  cancelled: { label: "Cancelled", color: "var(--muted)" },
};

/** Statuses that still need work. */
export const WO_ACTIVE = ["planned", "open", "in_progress", "awaiting_parts"];

export const woPriority: Record<string, StatusMeta> = {
  aog: { label: "AOG", color: "var(--danger)" },
  urgent: { label: "Urgent", color: "var(--warning)" },
  routine: { label: "Routine", color: "var(--accent)" },
};

export const woKind: Record<string, StatusMeta> = {
  scheduled: { label: "Scheduled", color: "var(--accent)" },
  unscheduled: { label: "Unscheduled", color: "var(--warning)" },
  inspection: { label: "Inspection", color: "var(--gold)" },
  modification: { label: "Modification", color: "var(--muted)" },
};

export type WorkOrder = {
  id: string;
  wo_no: string | null;
  title: string;
  description: string | null;
  kind: string;
  priority: string;
  status: string;
  aircraft_id: string | null;
  engine_id: string | null;
  defect_id: string | null;
  task_id: string | null;
  due_date: string | null;
  assigned_to: string | null;
  est_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  created_at: string;
  aircraft: { registration: string } | null;
  engines: { serial_number: string } | null;
  defects: { defect_no: string | null; description: string; status: string } | null;
  maintenance_tasks: { task_ref: string | null; title: string } | null;
};

export const WO_COLUMNS =
  "id, wo_no, title, description, kind, priority, status, aircraft_id, engine_id, defect_id, task_id, due_date, assigned_to, est_hours, actual_hours, started_at, completed_at, completion_notes, created_at, aircraft(registration), engines(serial_number), defects(defect_no, description, status), maintenance_tasks(task_ref, title)";

export const isWoOverdue = (w: { status: string; due_date: string | null }, today: string) =>
  WO_ACTIVE.includes(w.status) && !!w.due_date && w.due_date < today;

// ─── Maintenance programme ─────────────────────────────────────────────────
export type MaintenanceTask = {
  id: string;
  engine_id: string | null;
  aircraft_id: string | null;
  task_ref: string | null;
  title: string;
  ata_chapter: string | null;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_days: number | null;
  last_done_date: string | null;
  last_done_hours: number | null;
  last_done_cycles: number | null;
  active: boolean;
  notes: string | null;
};

export type DueState = "overdue" | "due_soon" | "ok" | "no_baseline";

export const dueState: Record<DueState, StatusMeta> = {
  overdue: { label: "Overdue", color: "var(--danger)" },
  due_soon: { label: "Due soon", color: "var(--warning)" },
  ok: { label: "In limits", color: "var(--success)" },
  no_baseline: { label: "No baseline", color: "var(--muted)" },
};

/** A task is "due soon" inside this window (days, or this share of its hour/cycle interval). */
export const DUE_SOON_DAYS = 30;
export const DUE_SOON_SHARE = 0.1;

export type TaskDue = {
  state: DueState;
  remainingHours: number | null;
  remainingCycles: number | null;
  remainingDays: number | null;
  /** Projected due date from the calendar limit and current utilisation, whichever comes first. */
  dueDate: string | null;
  /** Which limit drives the due date. */
  driver: "hours" | "cycles" | "days" | null;
};

const DAY = 86_400_000;
const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + Math.round(d) * DAY).toISOString().slice(0, 10);
const diffDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * Next-due calculation for one programme task.
 * `life` = the asset's current counters (engine TSN/CSN, aircraft total hours/cycles);
 * `rate` = average utilisation per day, used to turn hours/cycles into a projected date.
 */
export function taskDue(
  t: MaintenanceTask,
  life: { hours: number; cycles: number },
  rate: { hoursPerDay: number; cyclesPerDay: number },
  today: string,
): TaskDue {
  const remainingHours =
    t.interval_hours != null && t.last_done_hours != null ? Number(t.last_done_hours) + Number(t.interval_hours) - life.hours : null;
  const remainingCycles =
    t.interval_cycles != null && t.last_done_cycles != null ? t.last_done_cycles + t.interval_cycles - life.cycles : null;
  const remainingDays = t.interval_days != null && t.last_done_date ? diffDays(today, addDays(t.last_done_date, t.interval_days)) : null;

  // Hours/cycles → days at current utilisation. An unused asset never reaches an hour limit.
  const toDays = (remaining: number, perDay: number) => (perDay > 0 ? remaining / perDay : remaining <= 0 ? 0 : Infinity);
  const candidates: { days: number; driver: TaskDue["driver"] }[] = [];
  if (remainingDays != null) candidates.push({ days: remainingDays, driver: "days" });
  if (remainingHours != null) candidates.push({ days: toDays(remainingHours, rate.hoursPerDay), driver: "hours" });
  if (remainingCycles != null) candidates.push({ days: toDays(remainingCycles, rate.cyclesPerDay), driver: "cycles" });

  if (!candidates.length)
    return { state: "no_baseline", remainingHours, remainingCycles, remainingDays, dueDate: null, driver: null };

  const first = candidates.reduce((a, b) => (b.days < a.days ? b : a));
  const overdue = (remainingHours ?? 1) < 0 || (remainingCycles ?? 1) < 0 || (remainingDays ?? 1) < 0;
  const soon =
    first.days <= DUE_SOON_DAYS ||
    (remainingHours != null && remainingHours <= Number(t.interval_hours) * DUE_SOON_SHARE) ||
    (remainingCycles != null && remainingCycles <= Number(t.interval_cycles) * DUE_SOON_SHARE);

  return {
    state: overdue ? "overdue" : soon ? "due_soon" : "ok",
    remainingHours,
    remainingCycles,
    remainingDays,
    dueDate: Number.isFinite(first.days) ? addDays(today, first.days) : null,
    driver: first.driver,
  };
}

export const intervalLabel = (t: Pick<MaintenanceTask, "interval_hours" | "interval_cycles" | "interval_days">) =>
  [
    t.interval_hours != null && `${Number(t.interval_hours).toLocaleString("en-GB")} FH`,
    t.interval_cycles != null && `${t.interval_cycles.toLocaleString("en-GB")} cyc`,
    t.interval_days != null && `${t.interval_days} days`,
  ]
    .filter(Boolean)
    .join(" / ") || "—";

// ─── Inventory ──────────────────────────────────────────────────────────────
export const partCategory: Record<string, StatusMeta> = {
  engine_module: { label: "Engine module", color: "var(--gold)" },
  component: { label: "Component", color: "var(--accent)" },
  consumable: { label: "Consumable", color: "var(--success)" },
  hardware: { label: "Hardware", color: "var(--muted)" },
  tooling: { label: "Tooling", color: "var(--muted)" },
};

export const movementKind: Record<string, StatusMeta> = {
  receipt: { label: "Receipt", color: "var(--success)" },
  issue: { label: "Issue", color: "var(--warning)" },
  return: { label: "Return", color: "var(--accent)" },
  adjustment: { label: "Adjustment", color: "var(--muted)" },
};

export const stockLevel: Record<string, StatusMeta> = {
  out: { label: "Out of stock", color: "var(--danger)" },
  low: { label: "Below reorder", color: "var(--warning)" },
  ok: { label: "In stock", color: "var(--success)" },
};

export const stockState = (p: { quantity: number; min_quantity: number }) =>
  Number(p.quantity) <= 0 ? "out" : Number(p.quantity) < Number(p.min_quantity) ? "low" : "ok";

export type Part = {
  id: string;
  part_number: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  location: string;
  applicability: string | null;
  notes: string | null;
};

export const fmtQty = (n: number | string) => Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
