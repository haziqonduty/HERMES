import { RSection, RStats, RStatus, RTable, ReportSheet, ReportToolbar, ink, mono, reportStamp } from "@/components/report";
import { getCurrentUser } from "@/lib/auth";
import { OUTLOOK_DAYS, loadReadiness, riskMeta } from "@/lib/readiness";
import { aircraftStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Commander Brief · Hermes" };

export default async function CommanderBrief() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = new Date();
  const data = await loadReadiness(supabase, now);
  if (!data) return <p className="text-sm text-danger">Readiness data is not available.</p>;
  const { fleet, board, risks, downtime, today } = data;
  const pct = fleet.aircraft ? Math.round((fleet.ready / fleet.aircraft) * 100) : 0;

  return (
    <>
      <ReportToolbar back="/commander" backLabel="Commander View" />
      <ReportSheet
        kind="Commander Brief"
        title="Commander Brief — Engineering Readiness"
        subtitle={`As at ${today}`}
        generatedAt={reportStamp(now)}
        generatedBy={user.name}
      >
        <RSection title="Bottom line">
          <p className="mb-4 text-[14px]">
            <strong>{fleet.ready} of {fleet.aircraft}</strong> aircraft mission ready ({pct}%), {fleet.available} available including standby.{" "}
            {board.filter((b) => b.risk === "high").length} aircraft carry a high engineering risk;{" "}
            {fleet.aog ? `${fleet.aog} AOG work order(s) open` : "no AOG work orders"}.
          </p>
          <RStats
            items={[
              { label: "Mission ready", value: `${pct}%`, color: pct < 75 ? "var(--warning)" : "var(--success)" },
              { label: "Critical defects", value: fleet.criticalDefects, color: fleet.criticalDefects ? "var(--danger)" : undefined },
              { label: "Overdue maintenance", value: fleet.overdueTasks, color: fleet.overdueTasks ? "var(--warning)" : undefined },
              { label: "Spare engines", value: `${fleet.spares} (${fleet.inOverhaul} in O/H)` },
            ]}
          />
        </RSection>

        <RSection title="Aircraft">
          <RTable
            head={["Aircraft", "Status", "Risk", "Main issue", "Next downtime"]}
            empty="No aircraft."
            rows={board.map((a) => [
              <span key="r" className={mono}>{a.registration}</span>,
              <RStatus key="s" map={aircraftStatus} value={a.status} />,
              <RStatus key="k" map={riskMeta} value={a.risk} />,
              <span key="i" className="block min-w-48">{a.issues[0] ?? "—"}{a.issues.length > 1 && <span className="text-ink-muted"> (+{a.issues.length - 1})</span>}</span>,
              <span key="d" className="block min-w-32">
                {a.nextDowntime ? (
                  <>
                    <span className={mono} style={{ color: a.nextDowntime.overdue ? ink("var(--danger)") : undefined }}>{a.nextDowntime.overdue ? "Overdue" : a.nextDowntime.date}</span>
                    <span className="block text-[11px] text-ink-muted">{a.nextDowntime.what}</span>
                  </>
                ) : "—"}
              </span>,
            ])}
          />
        </RSection>

        <RSection title="Risks requiring attention" note={`${risks.filter((r) => r.level === "high").length} high · ${risks.filter((r) => r.level === "elevated").length} elevated`}>
          <RTable
            head={["Risk", "Item", "Detail"]}
            empty="No open risks."
            rows={risks.slice(0, 20).map((r) => [
              <RStatus key="l" map={riskMeta} value={r.level} />,
              <span key="t" className="block min-w-56">{r.title}</span>,
              <span key="d" className="block min-w-40 text-ink-muted">{r.detail}</span>,
            ])}
          />
          {risks.length > 20 && <p className="mt-2 text-[11px] text-ink-muted">{risks.length - 20} further elevated item(s) in HERMES.</p>}
        </RSection>

        <RSection title={`Planned downtime — next ${OUTLOOK_DAYS} days`}>
          <RTable
            head={["Date", "Aircraft", "Event"]}
            empty="Nothing planned in this window."
            rows={downtime.map((d) => [
              <span key="d" className={mono} style={{ color: d.overdue ? ink("var(--danger)") : undefined }}>{d.overdue ? "Overdue" : d.date}</span>,
              <span key="a" className={mono}>{d.aircraft}</span>,
              d.what,
            ])}
          />
        </RSection>
      </ReportSheet>
    </>
  );
}
