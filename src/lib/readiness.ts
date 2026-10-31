import "server-only";
import { AT_RISK_EHI } from "./health";
import { WO_ACTIVE, stockState, type Part } from "./maintenance";
import { loadPlanner, type PlannedTask } from "./maintenance-data";
import type { Level } from "./monitoring";
import { loadMonitoring, statusByEngine } from "./monitoring-data";
import type { StatusMeta } from "./status";
import type { createClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Risk = "high" | "elevated" | "normal";

export const riskMeta: Record<Risk, StatusMeta> = {
  high: { label: "High risk", color: "var(--danger)" },
  elevated: { label: "Elevated", color: "var(--warning)" },
  normal: { label: "Normal", color: "var(--success)" },
};

/** EHI below this is treated as a high (not just elevated) risk. */
const CRITICAL_EHI = 45;
/** Engines this close to overhaul (FH) are flagged. */
const OVERHAUL_FLAG_FH = 200;
/** Downtime horizon for the readiness outlook (days). */
export const OUTLOOK_DAYS = 90;

export type RiskItem = { level: Exclude<Risk, "normal">; title: string; detail: string; href: string; aircraft: string | null };

export type EngineSlot = { position: number; serial: string | null; ehi: number | null; monitor: Level | undefined; remaining: number | null };

export type Downtime = { date: string; aircraft: string; what: string; href: string; overdue: boolean };

export type AircraftReadiness = {
  id: string;
  registration: string;
  type: string;
  base: string | null;
  status: string;
  risk: Risk;
  issues: string[];
  engines: EngineSlot[];
  defects: { critical: number; major: number; minor: number };
  wos: { active: number; aog: number };
  tasks: { overdue: number; dueSoon: number };
  nextDowntime: Downtime | null;
};

type AircraftRow = { id: string; registration: string; aircraft_type: string; base: string | null; status: string; engine_positions?: number };
type EngineRow = {
  id: string;
  serial_number: string;
  status: string;
  ehi: number | null;
  tso: number | null;
  overhaul_interval_hours: number | null;
  engine_installations: { aircraft_id: string; position: number; removed_at: string | null }[];
};
type DefectRow = { id: string; defect_no: string | null; description: string; severity: string; status: string; aircraft_id: string | null; engine_id: string | null; deferred_until: string | null };
type WoRow = { id: string; wo_no: string | null; title: string; priority: string; aircraft_id: string | null };

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + Math.round(d) * 86_400_000).toISOString().slice(0, 10);

export async function loadReadiness(supabase: Supabase, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const since6m = addDays(today, -183);
  const outlook = addDays(today, OUTLOOK_DAYS);

  const [aircraftRes, enginesRes, limitsRes, defectsRes, wosRes, partsRes, monitoring, plan] = await Promise.all([
    supabase.from("aircraft").select("*").order("registration").returns<AircraftRow[]>(),
    supabase
      .from("engines")
      .select("id, serial_number, status, ehi, tso, overhaul_interval_hours, engine_installations(aircraft_id, position, removed_at)")
      .neq("status", "retired")
      .returns<EngineRow[]>(),
    supabase.from("engines").select("id, oil_limit_qph"),
    supabase.from("defects").select("id, defect_no, description, severity, status, aircraft_id, engine_id, deferred_until").neq("status", "closed").returns<DefectRow[]>(),
    supabase.from("work_orders").select("id, wo_no, title, priority, aircraft_id").in("status", WO_ACTIVE).returns<WoRow[]>(),
    supabase.from("parts").select("*").returns<Part[]>(),
    loadMonitoring(supabase, { since: since6m }),
    loadPlanner(supabase, today),
  ]);
  if (aircraftRes.error || enginesRes.error) return null;

  const aircraft = aircraftRes.data ?? [];
  const engines = enginesRes.data ?? [];
  const defects = defectsRes.data ?? [];
  const wos = wosRes.error ? [] : (wosRes.data ?? []);
  const tasks: PlannedTask[] = plan?.tasks ?? [];
  const monitor =
    monitoring && !limitsRes.error
      ? statusByEngine(monitoring, new Map((limitsRes.data ?? []).map((r) => [r.id as string, r.oil_limit_qph as number | null])))
      : new Map();

  const fittedTo = (e: EngineRow) => e.engine_installations.find((i) => !i.removed_at);
  const remainingOf = (e: EngineRow) => (e.overhaul_interval_hours && e.tso != null ? Number(e.overhaul_interval_hours) - Number(e.tso) : null);
  const rates = plan?.rates ?? new Map<string, { hoursPerDay: number }>();

  const risks: RiskItem[] = [];
  const push = (r: RiskItem) => risks.push(r);
  const allDowntime: Downtime[] = [];

  const board = aircraft.map((a): AircraftReadiness => {
    const fitted = engines.filter((e) => fittedTo(e)?.aircraft_id === a.id);
    const engineIds = new Set(fitted.map((e) => e.id));
    const myDefects = defects.filter((d) => d.aircraft_id === a.id || (d.engine_id && engineIds.has(d.engine_id)));
    const myWos = wos.filter((w) => w.aircraft_id === a.id);
    const myTasks = tasks.filter((t) => (t.aircraft_id === a.id) || (t.engine_id && engineIds.has(t.engine_id)));
    const issues: { level: Risk; text: string }[] = [];
    const reg = a.registration;

    for (const w of myWos.filter((w) => w.priority === "aog")) {
      issues.push({ level: "high", text: `AOG: ${w.title}` });
      push({ level: "high", title: `${reg} AOG — ${w.title}`, detail: w.wo_no ?? "Work order", href: `/work/${w.id}`, aircraft: reg });
    }
    for (const d of myDefects) {
      const expired = d.status === "deferred" && d.deferred_until && d.deferred_until < today;
      if (d.severity === "critical" || expired) {
        issues.push({ level: d.severity === "critical" ? "high" : "elevated", text: `${expired ? "Deferral expired" : "Critical defect"}: ${d.description}` });
        push({
          level: d.severity === "critical" ? "high" : "elevated",
          title: `${reg} — ${d.description}`,
          detail: `${d.defect_no ?? "Defect"} · ${expired ? "deferral expired" : "critical"}`,
          href: `/defects/${d.id}`,
          aircraft: reg,
        });
      } else if (d.severity === "major") {
        issues.push({ level: "elevated", text: `Major defect: ${d.description}` });
      }
    }
    for (const e of fitted) {
      const sn = e.serial_number;
      const href = `/engines/${encodeURIComponent(sn)}`;
      if (e.ehi != null && e.ehi < AT_RISK_EHI) {
        const level: Risk = e.ehi < CRITICAL_EHI ? "high" : "elevated";
        issues.push({ level, text: `Engine ${sn} EHI ${e.ehi}` });
        push({ level, title: `${reg} — engine ${sn} health ${e.ehi}`, detail: e.ehi < CRITICAL_EHI ? "EHI critical — engineering review" : "EHI warning — monitor closely", href: `${href}?tab=health`, aircraft: reg });
      }
      const m = monitor.get(e.id)?.overall as Level | undefined;
      if (m === "alert" || m === "caution") {
        const level: Risk = m === "alert" ? "high" : "elevated";
        issues.push({ level, text: `Engine ${sn} condition monitoring ${m}` });
        push({ level, title: `${reg} — engine ${sn} monitoring ${m}`, detail: "Oil / SOAP / chip / borescope finding", href: `${href}?tab=monitoring`, aircraft: reg });
      }
      const rem = remainingOf(e);
      if (rem != null && rem <= OVERHAUL_FLAG_FH) {
        issues.push({ level: "elevated", text: `Engine ${sn} overhaul in ${Math.round(rem)} FH` });
        push({ level: "elevated", title: `${reg} — engine ${sn} overhaul due`, detail: `${Math.round(rem)} FH remaining`, href, aircraft: reg });
      }
    }
    const overdue = myTasks.filter((t) => t.due.state === "overdue");
    if (overdue.length) {
      issues.push({ level: "high", text: `${overdue.length} maintenance task(s) overdue` });
      push({
        level: "high",
        title: `${reg} — ${overdue.length} maintenance task(s) overdue`,
        detail: overdue.slice(0, 2).map((t) => t.title).join(", ") + (overdue.length > 2 ? "…" : ""),
        href: `/planner?q=${encodeURIComponent(reg)}`,
        aircraft: reg,
      });
    }

    // Next planned downtime: aircraft-level inspections, or an engine reaching overhaul.
    const downtime: Downtime[] = [
      ...myTasks
        .filter((t) => t.aircraft_id === a.id && t.due.dueDate)
        .map((t) => ({ date: t.due.dueDate!, aircraft: reg, what: t.title, href: `/planner/${t.id}`, overdue: t.due.state === "overdue" })),
      ...fitted.flatMap((e) => {
        const rem = remainingOf(e);
        const perDay = rates.get(a.id)?.hoursPerDay ?? 0;
        if (rem == null) return [];
        const date = rem <= 0 ? today : perDay > 0 ? addDays(today, rem / perDay) : null;
        return date ? [{ date, aircraft: reg, what: `Engine ${e.serial_number} overhaul`, href: `/engines/${encodeURIComponent(e.serial_number)}`, overdue: rem <= 0 }] : [];
      }),
    ].sort((x, y) => x.date.localeCompare(y.date));
    allDowntime.push(...downtime);

    const order = { high: 0, elevated: 1, normal: 2 };
    issues.sort((x, y) => order[x.level] - order[y.level]);
    const risk: Risk = issues.some((i) => i.level === "high") ? "high" : issues.length ? "elevated" : "normal";

    const positions = a.engine_positions ?? Math.max(4, ...fitted.map((e) => fittedTo(e)!.position));
    return {
      id: a.id,
      registration: reg,
      type: a.aircraft_type,
      base: a.base,
      status: a.status,
      risk,
      issues: issues.map((i) => i.text),
      engines: Array.from({ length: positions }, (_, i) => {
        const e = fitted.find((x) => fittedTo(x)!.position === i + 1);
        return { position: i + 1, serial: e?.serial_number ?? null, ehi: e?.ehi ?? null, monitor: e ? (monitor.get(e.id)?.overall as Level | undefined) : undefined, remaining: e ? remainingOf(e) : null };
      }),
      defects: {
        critical: myDefects.filter((d) => d.severity === "critical").length,
        major: myDefects.filter((d) => d.severity === "major").length,
        minor: myDefects.filter((d) => d.severity === "minor").length,
      },
      wos: { active: myWos.length, aog: myWos.filter((w) => w.priority === "aog").length },
      tasks: { overdue: overdue.length, dueSoon: myTasks.filter((t) => t.due.state === "due_soon").length },
      nextDowntime: downtime[0] ?? null,
    };
  });

  // Fleet-level supply risk.
  const parts = partsRes.error ? [] : (partsRes.data ?? []);
  for (const p of parts.filter((p) => stockState(p) === "out"))
    push({ level: "elevated", title: `Out of stock — ${p.description}`, detail: `${p.part_number} · ${p.location}`, href: `/inventory/${p.id}`, aircraft: null });

  const order = { high: 0, elevated: 1 };
  risks.sort((x, y) => order[x.level] - order[y.level]);

  const downtime = allDowntime
    .filter((d) => d.date <= outlook)
    .sort((x, y) => x.date.localeCompare(y.date));

  const installed = engines.filter((e) => fittedTo(e)).length;
  const spares = engines.filter((e) => e.status === "spare" && !fittedTo(e)).length;
  const scored = engines.filter((e) => fittedTo(e) && e.ehi != null);

  return {
    today,
    board,
    risks,
    downtime,
    fleet: {
      aircraft: aircraft.length,
      ready: aircraft.filter((a) => a.status === "serviceable").length,
      available: aircraft.filter((a) => a.status === "serviceable" || a.status === "standby").length,
      byStatus: aircraft.reduce<Record<string, number>>((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {}),
      installed,
      spares,
      inOverhaul: engines.filter((e) => e.status === "in_overhaul").length,
      avgEhi: scored.length ? Math.round(scored.reduce((s, e) => s + Number(e.ehi), 0) / scored.length) : null,
      aog: wos.filter((w) => w.priority === "aog").length,
      criticalDefects: defects.filter((d) => d.severity === "critical").length,
      overdueTasks: tasks.filter((t) => t.due.state === "overdue").length,
    },
  };
}

export type Readiness = NonNullable<Awaited<ReturnType<typeof loadReadiness>>>;
