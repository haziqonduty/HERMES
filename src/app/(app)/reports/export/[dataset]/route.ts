import { fetchAll } from "@/lib/fetch-all";
import { intervalLabel } from "@/lib/maintenance";
import { loadPlanner } from "@/lib/maintenance-data";
import { isoDate, requestNow } from "@/lib/now";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Flattens embedded objects to "a.b" columns. */
const flatten = (row: Row, prefix = ""): Row =>
  Object.entries(row).reduce<Row>((out, [k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Row, `${prefix}${k}.`));
    else out[`${prefix}${k}`] = v;
    return out;
  }, {});

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote when needed; prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function toCsv(rows: Row[]) {
  const flat = rows.map((r) => flatten(r));
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  return [cols.join(","), ...flat.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

/** Every row of a table (paged past the 1000-row API limit), newest/first by `order`, ties broken by id. */
const all = async (s: Supabase, table: string, columns: string, order: string, ascending = true) =>
  (await fetchAll<Row>((from, to) => s.from(table).select(columns).order(order, { ascending }).order("id").range(from, to).returns<Row[]>())).data;

const datasets: Record<string, (supabase: Supabase, today: string) => Promise<Row[] | null>> = {
  aircraft: (s) => all(s, "aircraft", "registration, aircraft_type, serial_number, squadron, base, status, total_hours, total_cycles", "registration"),
  engines: (s) =>
    all(s, "engines", "serial_number, model, manufacturer, status, tsn, csn, tso, cso, overhaul_interval_hours, last_overhaul_date, ehi", "serial_number"),
  defects: (s) =>
    all(
      s,
      "defects",
      "defect_no, reported_at, aircraft(registration), engines(serial_number), ata_chapter, system, description, severity, status, failure_mode, detection_method, root_cause, action_taken, deferred_until, closed_at",
      "reported_at",
      false,
    ),
  "work-orders": (s) =>
    all(
      s,
      "work_orders",
      "wo_no, title, kind, priority, status, aircraft(registration), engines(serial_number), defects(defect_no), maintenance_tasks(task_ref), due_date, assigned_to, est_hours, actual_hours, started_at, completed_at, completion_notes",
      "created_at",
      false,
    ),
  maintenance: async (s, today) => {
    const plan = await loadPlanner(s, today);
    return plan
      ? plan.tasks.map((t) => ({
          task_ref: t.task_ref,
          title: t.title,
          ata_chapter: t.ata_chapter,
          asset: t.asset,
          aircraft: t.aircraftReg,
          interval: intervalLabel(t),
          last_done_date: t.last_done_date,
          last_done_hours: t.last_done_hours,
          status: t.due.state,
          remaining_hours: t.due.remainingHours,
          remaining_cycles: t.due.remainingCycles,
          remaining_days: t.due.remainingDays,
          projected_due: t.due.dueDate,
          open_wo: t.openWo?.wo_no,
        }))
      : null;
  },
  parts: (s) => all(s, "parts", "part_number, description, category, unit, quantity, min_quantity, location, applicability", "part_number"),
  movements: (s) =>
    all(s, "stock_movements", "moved_at, kind, quantity, parts(part_number, description, unit), work_orders(wo_no), reference, notes", "moved_at", false),
};

export async function GET(_req: Request, ctx: RouteContext<"/reports/export/[dataset]">) {
  const { dataset } = await ctx.params;
  const load = datasets[dataset];
  if (!load) return new Response("Unknown dataset", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in required", { status: 401 });

  const today = isoDate(await requestNow());
  const rows = await load(supabase, today);
  if (!rows) return new Response("Data not available — has the migration been run?", { status: 503 });

  // BOM so Excel opens UTF-8 (e.g. "—") correctly.
  return new Response("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hermes-${dataset}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
