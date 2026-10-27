import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, Database, Gauge, Info, ShieldAlert, Timer, Wrench } from "lucide-react";
import { Donut, EhiGauge, ehiTone } from "@/components/charts";
import { TrendChart } from "@/components/trend-chart";
import { Badge, StatusBadge, Table } from "@/components/ui";
import { AT_RISK_EHI, bandOf, ehiBands, monthlyAverage } from "@/lib/health";
import { channels } from "@/lib/monitoring";
import { describe, loadMonitoring, statusByEngine, type MonitorStatus } from "@/lib/monitoring-data";
import { aircraftStatus, defectSeverity, fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Executive Dashboard · Hermes" };

const OVERHAUL_WARN_FH = 200;

type EngineRow = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  ehi: number | null;
  tsn: number;
  tso: number | null;
  overhaul_interval_hours: number | null;
  engine_installations: { removed_at: string | null; position: number; aircraft: { registration: string } | null }[];
};

type DefectRow = {
  id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
  engines: { serial_number: string } | null;
  aircraft: { registration: string } | null;
};

type Alert = { level: "critical" | "warning" | "info"; title: string; detail: string; href: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const since12m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
  const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  const since6m = new Date(now.getTime() - 183 * 86_400_000).toISOString().slice(0, 10);

  const [engines, aircraft, defects, assessments, flights, oilLimits, monitoring] = await Promise.all([
    supabase
      .from("engines")
      .select("id, serial_number, model, status, ehi, tsn, tso, overhaul_interval_hours, engine_installations(removed_at, position, aircraft(registration))")
      .returns<EngineRow[]>(),
    supabase.from("aircraft").select("id, registration, status"),
    supabase
      .from("defects")
      .select("id, description, severity, status, reported_at, engines(serial_number), aircraft(registration)")
      .neq("status", "closed")
      .order("reported_at", { ascending: false })
      .returns<DefectRow[]>(),
    supabase.from("ehi_assessments").select("assessed_at, ehi").gte("assessed_at", since12m),
    supabase.from("flight_logs").select("flight_hours").gte("flight_date", since30d),
    supabase.from("engines").select("id, oil_limit_qph"),
    loadMonitoring(supabase, { since: since6m }),
  ]);

  if (engines.error || aircraft.error || defects.error) return <SetupNotice />;

  const engineRows = engines.data ?? [];
  const aircraftRows = aircraft.data ?? [];
  const openDefects = defects.data ?? [];

  const location = (e: EngineRow) => {
    const i = e.engine_installations.find((x) => !x.removed_at);
    return i?.aircraft ? `${i.aircraft.registration} #${i.position}` : "Store";
  };
  const remaining = (e: EngineRow) =>
    e.overhaul_interval_hours && e.tso != null ? e.overhaul_interval_hours - e.tso : null;

  const scored = engineRows.filter((e) => e.ehi != null) as (EngineRow & { ehi: number })[];
  const avgEhi = scored.length ? Math.round(scored.reduce((s, e) => s + e.ehi, 0) / scored.length) : null;
  const atRisk = scored.filter((e) => e.ehi < AT_RISK_EHI).sort((a, b) => a.ehi - b.ehi);
  const ready = aircraftRows.filter((a) => a.status === "serviceable").length;
  const readyPct = aircraftRows.length ? ((ready / aircraftRows.length) * 100).toFixed(1) : "—";
  const overhaulQueue = engineRows
    .filter((e) => remaining(e) != null && e.status !== "retired")
    .sort((a, b) => remaining(a)! - remaining(b)!);
  const overhaulSoon = overhaulQueue.filter((e) => remaining(e)! <= OVERHAUL_WARN_FH);

  const trend = assessments.error ? null : monthlyAverage(assessments.data ?? [], 12, now);
  const flownFH = (flights.data ?? []).reduce((s, f) => s + Number(f.flight_hours), 0);
  const fleetTSN = engineRows.reduce((s, e) => s + Number(e.tsn), 0);

  const engineHref = (sn: string) => `/engines/${encodeURIComponent(sn)}`;
  const monitorStatus =
    monitoring && !oilLimits.error
      ? statusByEngine(monitoring, new Map((oilLimits.data ?? []).map((r) => [r.id as string, r.oil_limit_qph as number | null])))
      : new Map<string, MonitorStatus>();
  const monitorAlerts: Alert[] = engineRows.flatMap((e) => {
    const s = monitorStatus.get(e.id);
    if (!s) return [];
    return channels.flatMap((c) => {
      const level = s[c.key]?.level;
      if (!level || level === "normal") return [];
      return [{
        level: level === "alert" ? "critical" : "warning",
        title: `${e.serial_number} — ${describe(c.key, s)}`,
        detail: `${location(e)} · ${c.label}`,
        href: `${engineHref(e.serial_number)}?tab=monitoring`,
      } satisfies Alert];
    });
  });
  const alerts: Alert[] = [
    ...atRisk.map((e) => ({
      level: (e.ehi < 45 ? "critical" : "warning") as Alert["level"],
      title: `${e.serial_number} — EHI ${e.ehi}`,
      detail: `${location(e)} · ${e.ehi < 45 ? "Immediate engineering review" : "Monitor closely"}`,
      href: `${engineHref(e.serial_number)}?tab=health`,
    })),
    ...monitorAlerts,
    ...openDefects.map((d) => ({
      level: (d.severity === "critical" ? "critical" : d.severity === "major" ? "warning" : "info") as Alert["level"],
      title: d.description,
      detail: [d.aircraft?.registration, d.engines?.serial_number, d.reported_at].filter(Boolean).join(" · "),
      href: d.engines ? `${engineHref(d.engines.serial_number)}?tab=defects` : d.aircraft ? `/fleet/${encodeURIComponent(d.aircraft.registration)}` : "/defects",
    })),
    ...overhaulSoon.map((e) => ({
      level: "warning" as const,
      title: `${e.serial_number} — overhaul due in ${fmtHours(remaining(e))} FH`,
      detail: location(e),
      href: engineHref(e.serial_number),
    })),
  ];
  const levelOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
  const count = (l: Alert["level"]) => alerts.filter((a) => a.level === l).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="label !text-gold">HERMES-E · Engineering Operations Center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Real-time overview of fleet readiness and engine health.</p>
      </div>

      {engineRows.length === 0 && aircraftRows.length === 0 && <EmptyNotice />}

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Total engines" value={engineRows.length} hint={`${engineRows.filter((e) => e.status === "installed").length} installed`} icon={<Gauge size={18} />} />
        <Kpi label="Mission ready" value={`${readyPct}${aircraftRows.length ? "%" : ""}`} hint={`${ready} / ${aircraftRows.length} aircraft`} tone="text-success" icon={<CheckCircle2 size={18} />} />
        <div className="panel flex flex-col items-center justify-center rounded-2xl p-4">
          <p className="label self-start">Engine Health Index (avg)</p>
          <EhiGauge value={avgEhi} />
        </div>
        <Kpi label="Engines at risk" value={atRisk.length} hint={`EHI below ${AT_RISK_EHI}`} tone="text-warning" icon={<AlertTriangle size={18} />} />
        <Kpi label="Open defects" value={openDefects.length} hint={`${openDefects.filter((d) => d.severity === "critical").length} critical`} tone="text-danger" icon={<ShieldAlert size={18} />} />
      </section>

      {/* Health trend + distribution */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-end justify-between">
            <p className="label">Fleet average EHI — last 12 months</p>
            {trend && <p className="font-mono text-xs text-muted">{assessments.data?.length ?? 0} assessments</p>}
          </div>
          <div className="mt-4">
            {trend ? (
              <TrendChart points={trend} threshold={AT_RISK_EHI} thresholdLabel={`At risk < ${AT_RISK_EHI}`} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">
                Run <code className="text-gold-soft">0003_engine_health_index.sql</code> to enable health trends.
              </p>
            )}
          </div>
        </div>

        <div className="panel rounded-2xl p-6">
          <p className="label">EHI distribution</p>
          <div className="mt-5 space-y-4">
            {[...ehiBands].reverse().map((b) => {
              const n = scored.filter((e) => bandOf(e.ehi).key === b.key).length;
              const pct = scored.length ? (n / scored.length) * 100 : 0;
              return (
                <div key={b.key}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {b.label} <span className="font-mono text-xs text-muted">{b.range}</span>
                    </span>
                    <span className="font-mono">{n}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-muted">{scored.length} of {engineRows.length} engines assessed.</p>
        </div>
      </section>

      {/* Readiness + at-risk */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-6">
          <p className="label">Fleet readiness status</p>
          <div className="mt-4 flex items-center gap-6">
            <Donut
              centre={String(aircraftRows.length)}
              sub="AIRCRAFT"
              segments={Object.entries(aircraftStatus).map(([key, s]) => ({
                value: aircraftRows.filter((a) => a.status === key).length,
                color: s.color,
              }))}
            />
            <ul className="space-y-2 text-sm">
              {Object.entries(aircraftStatus).map(([key, s]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted">{s.label}</span>
                  <span className="ml-auto pl-4 font-mono">{aircraftRows.filter((a) => a.status === key).length}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel overflow-hidden rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <p className="label">Top engines at risk</p>
            <Link href="/engines?sort=ehi" className="font-mono text-[11px] tracking-widest text-accent hover:underline">
              ALL ENGINES →
            </Link>
          </div>
          <div className="mt-3">
            <Table
              head={["Engine S/N", "Location", "EHI", "TSO (FH)", "Status"]}
              empty="No engines below the risk threshold."
              rows={atRisk.slice(0, 5).map((e) => {
                const tone = ehiTone(e.ehi);
                return [
                  <Link key="sn" href={`${engineHref(e.serial_number)}?tab=health`} className="font-mono hover:text-gold-soft">
                    {e.serial_number}
                  </Link>,
                  <span key="l" className="font-mono text-muted">{location(e)}</span>,
                  <span key="ehi" className="font-mono" style={{ color: tone.color }}>{e.ehi}</span>,
                  <span key="tso" className="font-mono text-muted">{fmtHours(e.tso)}</span>,
                  <Badge key="st" color={tone.color}>{tone.label}</Badge>,
                ];
              })}
            />
          </div>
        </div>
      </section>

      {/* Alerts, utilisation, overhaul */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-6">
          <p className="label">Alert summary</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <AlertCount icon={<AlertOctagon size={14} />} label="Critical" n={count("critical")} color="var(--danger)" />
            <AlertCount icon={<AlertTriangle size={14} />} label="Warning" n={count("warning")} color="var(--warning)" />
            <AlertCount icon={<Info size={14} />} label="Info" n={count("info")} color="var(--accent)" />
          </div>
          <ul className="mt-4 space-y-2">
            {alerts.slice(0, 4).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex gap-2.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-gold/40">
                  <span className="mt-0.5" style={{ color: levelColor[a.level] }}>{levelIcon[a.level]}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{a.title}</span>
                    <span className="block truncate font-mono text-[11px] text-muted">{a.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
            {alerts.length === 0 && <li className="text-sm text-muted">No active alerts.</li>}
          </ul>
        </div>

        <div className="panel rounded-2xl p-6">
          <p className="label">Fleet utilisation</p>
          <p className="mt-5 font-mono text-4xl tabular-nums">{fmtHours(flownFH)}</p>
          <p className="text-xs text-muted">Flight hours, last 30 days · {flights.data?.length ?? 0} flights logged</p>
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-2xl tabular-nums">{fmtHours(fleetTSN)}</p>
            <p className="text-xs text-muted">Total engine hours (TSN), all engines</p>
          </div>
        </div>

        <div className="panel overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 px-6 pt-6">
            <Timer size={14} className="text-gold" />
            <p className="label">Overhaul forecast</p>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {overhaulQueue.slice(0, 5).map((e) => {
              const r = remaining(e)!;
              return (
                <li key={e.id}>
                  <Link href={engineHref(e.serial_number)} className="flex items-center justify-between px-6 py-2.5 text-sm transition hover:bg-surface-2/60">
                    <span>
                      <span className="font-mono">{e.serial_number}</span>
                      <span className="ml-2 font-mono text-xs text-muted">{location(e)}</span>
                    </span>
                    <span className={`font-mono ${r <= OVERHAUL_WARN_FH ? "text-warning" : "text-muted"}`}>{fmtHours(r)} FH</span>
                  </Link>
                </li>
              );
            })}
            {overhaulQueue.length === 0 && <li className="px-6 py-4 text-sm text-muted">No overhaul intervals set.</li>}
          </ul>
        </div>
      </section>

      {/* Defects */}
      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 px-6 pt-6">
          <Wrench size={14} className="text-gold" />
          <p className="label">Open defects</p>
        </div>
        <div className="mt-3">
          <Table
            head={["Reported", "Aircraft", "Engine", "Description", "Severity"]}
            empty="No open defects."
            rows={openDefects.slice(0, 6).map((d) => [
              <span key="d" className="font-mono text-muted">{d.reported_at}</span>,
              <span key="a" className="font-mono">{d.aircraft?.registration ?? "—"}</span>,
              d.engines ? (
                <Link key="e" href={`${engineHref(d.engines.serial_number)}?tab=defects`} className="font-mono hover:text-gold-soft">
                  {d.engines.serial_number}
                </Link>
              ) : (
                <span key="e" className="text-muted">—</span>
              ),
              d.description,
              <StatusBadge key="s" map={defectSeverity} value={d.severity} />,
            ])}
          />
        </div>
      </section>
    </div>
  );
}

const levelColor = { critical: "var(--danger)", warning: "var(--warning)", info: "var(--accent)" };
const levelIcon = {
  critical: <AlertOctagon size={14} />,
  warning: <AlertTriangle size={14} />,
  info: <Info size={14} />,
};

function AlertCount({ icon, label, n, color }: { icon: React.ReactNode; label: string; n: number; color: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}>
      <p className="flex items-center gap-1.5 text-xs" style={{ color }}>
        {icon} {label}
      </p>
      <p className="mt-1 font-mono text-2xl">{n}</p>
    </div>
  );
}

function Kpi({ label, value, hint, icon, tone = "text-foreground" }: { label: string; value: string | number; hint: string; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="label">{label}</p>
        <span className={`${tone} opacity-80`}>{icon}</span>
      </div>
      <p className={`mt-4 font-mono text-4xl font-medium tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="panel mx-auto max-w-2xl rounded-2xl p-8">
      <Database className="text-gold" />
      <h1 className="mt-4 text-xl font-medium">Database not initialised</h1>
      <p className="mt-2 text-sm text-muted">
        Run the scripts in <code className="text-gold-soft">supabase/migrations/</code> in the Supabase SQL Editor, then refresh this page.
      </p>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 px-5 py-4 text-sm text-gold-soft">
      No fleet data yet. Add aircraft in <Link href="/fleet" className="underline">Fleet Overview</Link> and engines in{" "}
      <Link href="/engines" className="underline">Engines</Link>.
    </div>
  );
}
