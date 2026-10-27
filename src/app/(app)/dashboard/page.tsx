import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, Gauge, ShieldAlert, Wrench } from "lucide-react";
import { Donut, EhiGauge, ehiTone } from "@/components/charts";
import { Badge, StatusBadge, Table } from "@/components/ui";
import { defectSeverity } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Executive Dashboard · Hermes" };

const AT_RISK_EHI = 60;

const aircraftStatus = [
  { key: "serviceable", label: "Mission ready", color: "var(--success)" },
  { key: "standby", label: "Standby", color: "var(--accent)" },
  { key: "in_maintenance", label: "In maintenance", color: "var(--warning)" },
  { key: "unserviceable", label: "Unserviceable", color: "var(--danger)" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [engines, aircraft, defects] = await Promise.all([
    supabase.from("engines").select("id, serial_number, model, status, ehi, tsn, tso, overhaul_interval_hours"),
    supabase.from("aircraft").select("id, registration, status"),
    supabase
      .from("defects")
      .select("id, description, severity, status, reported_at, engines(serial_number), aircraft(registration)")
      .neq("status", "closed")
      .order("reported_at", { ascending: false }),
  ]);

  if (engines.error || aircraft.error || defects.error) return <SetupNotice />;

  const engineRows = engines.data;
  const aircraftRows = aircraft.data;
  const openDefects = defects.data;

  const scored = engineRows.filter((e) => e.ehi != null);
  const avgEhi = scored.length ? Math.round(scored.reduce((s, e) => s + e.ehi!, 0) / scored.length) : null;
  const atRisk = scored.filter((e) => e.ehi! < AT_RISK_EHI).sort((a, b) => a.ehi! - b.ehi!);
  const ready = aircraftRows.filter((a) => a.status === "serviceable").length;
  const readyPct = aircraftRows.length ? ((ready / aircraftRows.length) * 100).toFixed(1) : "—";
  const overhaulSoon = engineRows.filter(
    (e) => e.overhaul_interval_hours && e.tso != null && e.overhaul_interval_hours - e.tso <= 200,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label !text-gold">HERMES-E · Engineering Operations Center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Real-time overview of fleet readiness and engine health.</p>
        </div>
      </div>

      {engineRows.length === 0 && aircraftRows.length === 0 && <EmptyNotice />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Total engines" value={engineRows.length} hint="Tracked in HERMES" icon={<Gauge size={18} />} />
        <Kpi
          label="Mission ready"
          value={`${readyPct}${aircraftRows.length ? "%" : ""}`}
          hint={`${ready} / ${aircraftRows.length} aircraft`}
          tone="text-success"
          icon={<CheckCircle2 size={18} />}
        />
        <div className="panel flex flex-col items-center justify-center rounded-2xl p-4">
          <p className="label self-start">Engine Health Index (avg)</p>
          <EhiGauge value={avgEhi} />
        </div>
        <Kpi
          label="Engines at risk"
          value={atRisk.length}
          hint={`EHI below ${AT_RISK_EHI}`}
          tone="text-warning"
          icon={<AlertTriangle size={18} />}
        />
        <Kpi
          label="Open defects"
          value={openDefects.length}
          hint={`${overhaulSoon.length} engine(s) ≤200 FH to overhaul`}
          tone="text-danger"
          icon={<ShieldAlert size={18} />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-6">
          <p className="label">Fleet readiness status</p>
          <div className="mt-4 flex items-center gap-6">
            <Donut
              centre={String(aircraftRows.length)}
              sub="AIRCRAFT"
              segments={aircraftStatus.map((s) => ({
                value: aircraftRows.filter((a) => a.status === s.key).length,
                color: s.color,
              }))}
            />
            <ul className="space-y-2 text-sm">
              {aircraftStatus.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted">{s.label}</span>
                  <span className="ml-auto pl-4 font-mono">
                    {aircraftRows.filter((a) => a.status === s.key).length}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel overflow-hidden rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <p className="label">Top engines at risk</p>
            <Link href="/health" className="font-mono text-[11px] tracking-widest text-accent hover:underline">
              HEALTH MONITORING →
            </Link>
          </div>
          <div className="mt-3">
            <Table
              head={["Engine S/N", "Model", "EHI", "TSO (FH)", "Status"]}
              empty="No engines below the risk threshold."
              rows={atRisk.slice(0, 5).map((e) => {
                const tone = ehiTone(e.ehi);
                return [
                  <Link
                    key="sn"
                    href={`/engines/${encodeURIComponent(e.serial_number)}`}
                    className="font-mono hover:text-gold-soft"
                  >
                    {e.serial_number}
                  </Link>,
                  e.model,
                  <span key="ehi" className="font-mono" style={{ color: tone.color }}>
                    {e.ehi}
                  </span>,
                  <span key="tso" className="font-mono text-muted">
                    {e.tso ?? "—"}
                  </span>,
                  <Badge key="st" color={tone.color}>
                    {tone.label}
                  </Badge>,
                ];
              })}
            />
          </div>
        </div>
      </section>

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
              <span key="d" className="font-mono text-muted">
                {d.reported_at}
              </span>,
              <span key="a" className="font-mono">
                {one(d.aircraft)?.registration ?? "—"}
              </span>,
              <span key="e" className="font-mono">
                {one(d.engines)?.serial_number ?? "—"}
              </span>,
              d.description,
              <StatusBadge key="s" map={defectSeverity} value={d.severity} />,
            ])}
          />
        </div>
      </section>
    </div>
  );
}

/** Supabase types embedded relations loosely; normalise to a single row. */
function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  tone?: string;
}) {
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
        Run <code className="text-gold-soft">supabase/migrations/0001_foundation.sql</code> in the Supabase SQL Editor,
        then refresh this page.
      </p>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 px-5 py-4 text-sm text-gold-soft">
      No fleet data yet. Load the sample fleet with <code>supabase/seed.sql</code>, or add aircraft and engines once the
      Fleet and Engine Passport modules are live.
    </div>
  );
}
