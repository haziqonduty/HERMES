import { notFound, redirect } from "next/navigation";
import { RSection, RStats, RStatus, RTable, ReportSheet, ReportToolbar, ink, mono, reportStamp } from "@/components/report";
import { getCurrentUser } from "@/lib/auth";
import { removalType } from "@/lib/defects";
import { bandOf, ehiComponents, type Assessment } from "@/lib/health";
import { dueState, intervalLabel, woStatus } from "@/lib/maintenance";
import { loadPlanner } from "@/lib/maintenance-data";
import { channels, monitorLevel } from "@/lib/monitoring";
import { describe, loadMonitoring, statusByEngine } from "@/lib/monitoring-data";
import { defectSeverity, defectStatus, engineStatus, fmtHours, fmtInt } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";

export const metadata = { title: "Engine Report" };

type Engine = {
  id: string;
  serial_number: string;
  model: string;
  manufacturer: string | null;
  status: string;
  tsn: number;
  csn: number;
  tso: number | null;
  cso: number | null;
  overhaul_interval_hours: number | null;
  last_overhaul_date: string | null;
  ehi: number | null;
  oil_limit_qph?: number | null;
  notes: string | null;
};
type Installation = {
  position: number;
  installed_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  removal_type?: string | null;
  aircraft: { registration: string } | null;
};

/** /reports/engine?serial=<serial number> */
export default async function EngineReport({ searchParams }: PageProps<"/reports/engine">) {
  const { serial } = (await searchParams) as { serial?: string };
  if (!serial) redirect("/reports");

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data: e } = await supabase.from("engines").select("*").eq("serial_number", serial).returns<Engine[]>().maybeSingle();
  if (!e) notFound();

  const now = await requestNow();
  const today = isoDate(now);
  const [instRes, ehiRes, monitoring, defectsRes, plan, wosRes] = await Promise.all([
    supabase.from("engine_installations").select("*, aircraft(registration)").eq("engine_id", e.id).order("installed_at", { ascending: false }).returns<Installation[]>(),
    supabase.from("ehi_assessments").select("*").eq("engine_id", e.id).order("assessed_at", { ascending: false }).limit(6).returns<(Assessment & { ehi: number })[]>(),
    loadMonitoring(supabase, { engineId: e.id }),
    supabase
      .from("defects")
      .select("defect_no, reported_at, description, severity, status, closed_at")
      .eq("engine_id", e.id)
      .order("reported_at", { ascending: false })
      .limit(100),
    loadPlanner(supabase, today, { engineId: e.id }),
    supabase
      .from("work_orders")
      .select("wo_no, title, status, due_date, completed_at")
      .eq("engine_id", e.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const installs = instRes.data ?? [];
  const fitted = installs.find((i) => !i.removed_at);
  const removals = installs.filter((i) => i.removed_at);
  const assessments = ehiRes.error ? null : (ehiRes.data ?? []);
  const latest = assessments?.[0];
  const status = monitoring ? statusByEngine(monitoring, new Map([[e.id, e.oil_limit_qph ?? null]])).get(e.id) : undefined;
  const defects = defectsRes.data ?? [];
  const openDefects = defects.filter((d) => d.status !== "closed");
  const remaining = e.overhaul_interval_hours && e.tso != null ? Number(e.overhaul_interval_hours) - Number(e.tso) : null;

  return (
    <>
      <ReportToolbar />
      <ReportSheet
        kind="Engine Report"
        title={`Engine ${e.serial_number}`}
        subtitle={`${e.model}${e.manufacturer ? ` · ${e.manufacturer}` : ""} · ${fitted?.aircraft ? `fitted to ${fitted.aircraft.registration} position ${fitted.position}` : engineStatus[e.status]?.label ?? e.status}`}
        generatedAt={reportStamp(now)}
        generatedBy={user.name}
      >
        <RSection title="Life and status">
          <RStats
            items={[
              { label: "Status", value: engineStatus[e.status]?.label ?? e.status, color: engineStatus[e.status]?.color },
              { label: "TSN / CSN", value: `${fmtHours(e.tsn)} / ${fmtInt(e.csn)}` },
              { label: "TSO / CSO", value: `${fmtHours(e.tso)} / ${fmtInt(e.cso)}` },
              { label: "Hours to overhaul", value: remaining != null ? fmtHours(remaining) : "—", color: remaining != null && remaining < 300 ? "var(--warning)" : undefined },
              { label: "Overhaul interval", value: e.overhaul_interval_hours ? `${fmtHours(e.overhaul_interval_hours)} FH` : "—" },
              { label: "Last overhaul", value: e.last_overhaul_date ?? "—" },
              { label: "Engine Health Index", value: e.ehi ?? "—", color: e.ehi != null ? bandOf(e.ehi).color : undefined },
              { label: "Open defects", value: openDefects.length, color: openDefects.length ? "var(--warning)" : undefined },
            ]}
          />
        </RSection>

        {assessments && (
          <RSection title="Health assessments" note="Latest six">
            {latest && (
              <p className="mb-3">
                Latest ({latest.assessed_at}):{" "}
                {ehiComponents.map((c) => `${c.label} ${latest[c.key]}`).join(" · ")}
              </p>
            )}
            <RTable
              head={["Date", "EHI", "Band", "Source", "Notes"]}
              empty="No assessments recorded."
              rows={assessments.map((a) => [
                <span key="d" className={mono}>{a.assessed_at}</span>,
                <span key="e" className={mono}>{a.ehi}</span>,
                <span key="b" style={{ color: ink(bandOf(a.ehi).color) }}>{bandOf(a.ehi).label}</span>,
                a.source ?? "—",
                <span key="n" className="block min-w-40">{a.notes ?? "—"}</span>,
              ])}
            />
          </RSection>
        )}

        {monitoring && (
          <RSection title="Condition monitoring" note="Latest record per channel">
            <RTable
              head={["Channel", "Level", "Latest finding"]}
              empty="—"
              rows={channels.map((c) => {
                const level = status?.[c.key]?.level;
                return [
                  c.label,
                  level ? <RStatus key="l" map={monitorLevel} value={level} /> : <span key="l" className="text-ink-muted">No data</span>,
                  <span key="d" className="block min-w-56">{(status && describe(c.key, status)) || "—"}</span>,
                ];
              })}
            />
          </RSection>
        )}

        <RSection title="Defects" note={`${openDefects.length} open · ${defects.length - openDefects.length} closed`}>
          <RTable
            head={["Defect", "Reported", "Description", "Severity", "Status", "Closed"]}
            empty="No defects recorded against this engine."
            rows={defects.slice(0, 15).map((d) => [
              <span key="n" className={mono}>{d.defect_no ?? "—"}</span>,
              <span key="r" className={mono}>{d.reported_at}</span>,
              <span key="d" className="block min-w-48">{d.description}</span>,
              <RStatus key="s" map={defectSeverity} value={d.severity} />,
              <RStatus key="st" map={defectStatus} value={d.status} />,
              <span key="c" className={mono}>{d.closed_at ?? "—"}</span>,
            ])}
          />
        </RSection>

        <RSection title="Installation history">
          <RTable
            head={["Aircraft", "Pos.", "Installed", "Removed", "Type", "Reason"]}
            empty="Never installed."
            rows={installs.map((i) => [
              <span key="a" className={mono}>{i.aircraft?.registration ?? "—"}</span>,
              <span key="p" className={mono}>{i.position}</span>,
              <span key="i" className={mono}>{i.installed_at}</span>,
              <span key="r" className={mono}>{i.removed_at ?? "Fitted"}</span>,
              i.removal_type ? <RStatus key="t" map={removalType} value={i.removal_type} /> : "—",
              <span key="re" className="block min-w-40">{i.removal_reason ?? "—"}</span>,
            ])}
          />
          {removals.length > 0 && <p className="mt-2 text-[11px] text-ink-muted">{removals.length} removal(s) on record.</p>}
        </RSection>

        {plan && (
          <RSection title="Maintenance programme">
            <RTable
              head={["Task", "Interval", "Last done", "Status", "Projected due"]}
              empty="No programme tasks for this engine."
              rows={plan.tasks.map((t) => [
                <span key="t" className="block min-w-48">{t.title}{t.task_ref && <span className="text-ink-muted"> · {t.task_ref}</span>}</span>,
                intervalLabel(t),
                <span key="l" className={mono}>{t.last_done_date ?? "—"}</span>,
                <RStatus key="s" map={dueState} value={t.due.state} />,
                <span key="d" className={mono}>{t.due.dueDate ?? "—"}</span>,
              ])}
            />
          </RSection>
        )}

        {!wosRes.error && (
          <RSection title="Recent work orders">
            <RTable
              head={["WO", "Title", "Status", "Due", "Completed"]}
              empty="No work orders."
              rows={(wosRes.data ?? []).map((w) => [
                <span key="n" className={mono}>{w.wo_no}</span>,
                <span key="t" className="block min-w-48">{w.title}</span>,
                <RStatus key="s" map={woStatus} value={w.status} />,
                <span key="d" className={mono}>{w.due_date ?? "—"}</span>,
                <span key="c" className={mono}>{w.completed_at ?? "—"}</span>,
              ])}
            />
          </RSection>
        )}

        {e.notes && (
          <RSection title="Notes">
            <p className="whitespace-pre-wrap">{e.notes}</p>
          </RSection>
        )}
      </ReportSheet>
    </>
  );
}
