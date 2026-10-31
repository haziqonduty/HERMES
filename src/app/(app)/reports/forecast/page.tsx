import { RSection, RStats, RStatus, RTable, ReportSheet, ReportToolbar, mono, reportStamp } from "@/components/report";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { dueState, intervalLabel } from "@/lib/maintenance";
import { UTILISATION_DAYS, loadOverhaulForecast, loadPlanner } from "@/lib/maintenance-data";
import { fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";

export const metadata = { title: "Maintenance Forecast · Hermes" };

const DAYS_AHEAD = 90;

export default async function ForecastReport() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = await requestNow();
  const today = now.toISOString().slice(0, 10);
  const plan = await loadPlanner(supabase, today);
  if (!plan) return <SetupNotice module="Maintenance Planner" file="0006_maintenance.sql" />;
  const overhaul = await loadOverhaulForecast(supabase, plan.rates, today);

  const until = new Date(now.getTime() + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);
  const horizon = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  const window = plan.tasks.filter((t) => t.due.state === "overdue" || (t.due.dueDate && t.due.dueDate <= until));
  const overdue = window.filter((t) => t.due.state === "overdue");
  const upcoming = window.filter((t) => t.due.state !== "overdue");
  const months = [...new Set(upcoming.map((t) => t.due.dueDate!.slice(0, 7)))].sort();
  const overhaulYear = overhaul.filter((e) => e.remaining <= 0 || (e.dueDate && e.dueDate <= horizon));
  const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const taskRows = (list: typeof window) =>
    list.map((t) => [
      <span key="d" className={mono}>{t.due.dueDate ?? "—"}</span>,
      <span key="t" className="block min-w-48">{t.title}{t.task_ref && <span className="text-ink-muted"> · {t.task_ref}</span>}</span>,
      <span key="a" className={mono}>{t.asset}{t.engine_id && t.aircraftReg ? ` (${t.aircraftReg})` : ""}</span>,
      intervalLabel(t),
      <RStatus key="s" map={dueState} value={t.due.state} />,
      <span key="w" className={mono}>{t.openWo?.wo_no ?? "—"}</span>,
    ]);
  const head = ["Due", "Task", "Asset", "Interval", "Status", "WO"];

  return (
    <>
      <ReportToolbar csv={[{ href: "/reports/export/maintenance", label: "Programme CSV" }]} />
      <ReportSheet
        kind="Maintenance Forecast"
        title="Maintenance Forecast"
        subtitle={`Next ${DAYS_AHEAD} days from ${today} · overhauls over 12 months`}
        generatedAt={reportStamp(now)}
        generatedBy={user.name}
      >
        <RSection title="Summary" note={`Hour limits projected from utilisation over the last ${UTILISATION_DAYS} days`}>
          <RStats
            items={[
              { label: "Overdue now", value: overdue.length, color: overdue.length ? "var(--danger)" : undefined },
              { label: `Due in ${DAYS_AHEAD} days`, value: upcoming.length, color: "var(--warning)" },
              { label: "Without work order", value: window.filter((t) => !t.openWo).length },
              { label: "Overhauls in 12 months", value: overhaulYear.length, color: overhaulYear.length ? "var(--gold)" : undefined },
            ]}
          />
        </RSection>

        <RSection title="Overdue">
          <RTable head={head} empty="No overdue tasks." rows={taskRows(overdue)} />
        </RSection>

        {months.map((m) => (
          <RSection key={m} title={monthName(m)}>
            <RTable head={head} empty="—" rows={taskRows(upcoming.filter((t) => t.due.dueDate!.startsWith(m)))} />
          </RSection>
        ))}

        <RSection title="Engine overhaul forecast" note="Engines reaching overhaul interval within 12 months">
          <RTable
            head={["Engine", "Location", "TSO", "Interval", "Remaining FH", "Projected"]}
            empty="No engines reach overhaul in the next 12 months."
            rows={overhaulYear.map((e) => [
              <span key="sn" className={mono}>{e.serial_number}</span>,
              <span key="l" className={mono}>{e.location}</span>,
              <span key="t" className={mono}>{fmtHours(e.tso)}</span>,
              <span key="i" className={mono}>{fmtHours(e.interval)}</span>,
              <span key="r" className={mono} style={{ color: e.remaining <= 0 ? "var(--bad-ink)" : undefined }}>{fmtHours(e.remaining)}</span>,
              <span key="d" className={mono}>{e.dueDate ?? "—"}</span>,
            ])}
          />
        </RSection>
      </ReportSheet>
    </>
  );
}
