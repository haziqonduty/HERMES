import Link from "next/link";
import { AlertOctagon, AlertTriangle, FileText } from "lucide-react";
import { Donut, ehiTone } from "@/components/charts";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink, KpiCard, PageHeader } from "@/components/ui";
import { OUTLOOK_DAYS, loadReadiness, riskMeta } from "@/lib/readiness";
import { aircraftStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";
import { AircraftCard } from "./aircraft-card";

export const metadata = { title: "Commander View · Hermes" };

export default async function CommanderPage() {
  const supabase = await createClient();
  const data = await loadReadiness(supabase, await requestNow());
  if (!data) return <SetupNotice module="Commander View" file="0001_foundation.sql" />;
  const { fleet, board, risks, downtime } = data;
  const pct = fleet.aircraft ? Math.round((fleet.ready / fleet.aircraft) * 100) : 0;
  const highRisk = board.filter((b) => b.risk === "high").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Command"
        title="Commander View"
        description="Mission readiness, what is holding aircraft back, and the risks that need a decision."
        actions={
          <ButtonLink href="/reports/brief" variant="primary">
            <FileText size={16} /> Commander brief
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <section className="panel flex flex-wrap items-center gap-6 rounded-2xl p-6">
          <Donut
            segments={Object.entries(aircraftStatus).map(([k, m]) => ({ value: fleet.byStatus[k] ?? 0, color: m.color }))}
            centre={`${pct}%`}
            sub="MISSION READY"
          />
          <div className="min-w-40 flex-1">
            <p className="label">Fleet readiness</p>
            <p className="mt-2 font-mono text-4xl font-medium tabular-nums">
              {fleet.ready}<span className="text-xl text-muted">/{fleet.aircraft}</span>
            </p>
            <p className="text-xs text-muted">aircraft mission ready · {fleet.available} available incl. standby</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {Object.entries(aircraftStatus).map(([k, m]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  <span className="flex-1 text-muted">{m.label}</span>
                  <span className="font-mono">{fleet.byStatus[k] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="High-risk aircraft" value={highRisk} hint="Need a decision today" color={highRisk ? "var(--danger)" : "var(--success)"} />
          <KpiCard label="AOG work orders" value={fleet.aog} hint="Aircraft on ground" color={fleet.aog ? "var(--danger)" : undefined} />
          <KpiCard label="Critical defects" value={fleet.criticalDefects} hint="Open, severity critical" color={fleet.criticalDefects ? "var(--danger)" : undefined} />
          <KpiCard label="Overdue maintenance" value={fleet.overdueTasks} hint="Programme tasks past limit" color={fleet.overdueTasks ? "var(--warning)" : undefined} />
          <KpiCard label="Spare engines" value={fleet.spares} hint={`Serviceable spares for ${fleet.installed} installed · ${fleet.inOverhaul} in overhaul`} color="var(--accent)" />
          <KpiCard label="Fleet engine health" value={fleet.avgEhi ?? "—"} hint="Average EHI, installed engines" color={ehiTone(fleet.avgEhi).color} />
        </section>
      </div>

      <section>
        <p className="label mb-3">Aircraft status board</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.map((a) => (
            <AircraftCard key={a.id} a={a} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="panel rounded-2xl p-6 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <p className="label">Risk register</p>
            <p className="font-mono text-xs text-muted">
              {risks.filter((r) => r.level === "high").length} high · {risks.filter((r) => r.level === "elevated").length} elevated
            </p>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {risks.slice(0, 12).map((r, i) => (
              <li key={i}>
                <Link href={r.href} className="flex items-start gap-3 py-3 transition hover:text-gold-soft">
                  <span className="mt-0.5" style={{ color: riskMeta[r.level].color }}>
                    {r.level === "high" ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{r.title}</span>
                    <span className="block text-xs text-muted">{r.detail}</span>
                  </span>
                  <span className="whitespace-nowrap text-[11px]" style={{ color: riskMeta[r.level].color }}>{riskMeta[r.level].label}</span>
                </Link>
              </li>
            ))}
            {risks.length === 0 && <li className="py-3 text-sm text-muted">No open risks.</li>}
          </ul>
          {risks.length > 12 && <p className="mt-2 text-xs text-muted">+{risks.length - 12} more in the commander brief.</p>}
        </section>

        <section className="panel rounded-2xl p-6 lg:col-span-2">
          <p className="label">Planned downtime — next {OUTLOOK_DAYS} days</p>
          <p className="mt-1 text-xs text-muted">Aircraft inspections and engine overhauls, projected from current utilisation.</p>
          <ul className="mt-4 space-y-2">
            {downtime.slice(0, 12).map((d, i) => (
              <li key={i}>
                <Link href={d.href} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-gold/40">
                  <span className={`w-24 shrink-0 font-mono text-xs ${d.overdue ? "text-danger" : "text-muted"}`}>{d.overdue ? "OVERDUE" : d.date}</span>
                  <span className="w-16 shrink-0 font-mono">{d.aircraft}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{d.what}</span>
                </Link>
              </li>
            ))}
            {downtime.length === 0 && <li className="text-sm text-muted">Nothing planned in this window.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
