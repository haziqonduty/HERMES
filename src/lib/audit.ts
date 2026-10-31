import type { StatusMeta } from "./status";

export type AuditRow = {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor: string | null;
  at: string;
};

export const auditAction: Record<string, StatusMeta> = {
  INSERT: { label: "Created", color: "var(--success)" },
  UPDATE: { label: "Changed", color: "var(--accent)" },
  DELETE: { label: "Deleted", color: "var(--danger)" },
};

/** Human names for audited tables, in menu order. */
export const auditTables: Record<string, string> = {
  aircraft: "Aircraft",
  engines: "Engines",
  engine_installations: "Installations",
  flight_logs: "Flight logs",
  defects: "Defects",
  ehi_assessments: "Health assessments",
  oil_uplifts: "Oil uplifts",
  oil_samples: "Oil samples",
  chip_checks: "Chip checks",
  borescope_inspections: "Borescope",
  maintenance_tasks: "Maintenance tasks",
  work_orders: "Work orders",
  work_order_steps: "Task-card steps",
  parts: "Store items",
  stock_movements: "Stock movements",
  profiles: "Users",
};

const str = (v: unknown) => (v == null ? "" : String(v));

/** A short identifying label for a record (defect no., WO no., serial…). */
export function recordLabel(table: string, d: Record<string, unknown> | null) {
  if (!d) return "—";
  const pick = ["defect_no", "wo_no", "serial_number", "registration", "part_number", "task_ref", "full_name", "title", "instruction", "description", "sortie_ref", "reference"];
  for (const k of pick) if (d[k]) return str(d[k]).slice(0, 80);
  if (table === "flight_logs") return `${str(d.flight_date)} · ${str(d.flight_hours)} FH`;
  return str(d.id).slice(0, 8);
}

/** Link to the record's page in HERMES, where one exists. */
export function recordHref(table: string, d: Record<string, unknown> | null, id: string | null) {
  if (!d || !id) return null;
  switch (table) {
    case "defects":
      return `/defects/${id}`;
    case "work_orders":
      return `/work/${id}`;
    case "work_order_steps":
      return d.work_order_id ? `/work/${str(d.work_order_id)}` : null;
    case "maintenance_tasks":
      return `/planner/${id}`;
    case "parts":
      return `/inventory/${id}`;
    case "stock_movements":
      return d.part_id ? `/inventory/${str(d.part_id)}` : null;
    case "engines":
      return d.serial_number ? `/engines/${encodeURIComponent(str(d.serial_number))}` : null;
    case "aircraft":
      return d.registration ? `/fleet/${encodeURIComponent(str(d.registration))}` : null;
    case "profiles":
      return `/admin/users/${id}`;
    default:
      return null;
  }
}

const IGNORED = new Set(["updated_at", "created_at"]);
const show = (v: unknown) => {
  if (v == null || v === "") return "∅";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/** Field-level changes of an UPDATE, e.g. "status: open → closed". */
export function auditChanges(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData || !newData) return [];
  return Object.keys(newData)
    .filter((k) => !IGNORED.has(k) && JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]))
    .map((k) => ({ field: k.replace(/_/g, " "), from: show(oldData[k]), to: show(newData[k]) }));
}

/** Audit timestamps in Malaysia time. */
export const auditTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
