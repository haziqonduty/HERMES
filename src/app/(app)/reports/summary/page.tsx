import { RSection, RStats, RStatus, RTable, ReportSheet, ReportToolbar, ink, mono, reportStamp } from "@/components/report";
import { getCurrentUser } from "@/lib/auth";
import { AT_RISK_EHI, bandOf } from "@/lib/health";
import { WO_ACTIVE, dueState, stockLevel, stockState, woPriority, woStatus, type Part } from "@/lib/maintenance";
import { loadOverhaulForecast, loadPlanner } from "@/lib/maintenance-data";
import { channels, monitorLevel } from "@/lib/monitoring";
import { describe, loadMonitoring, statusByEngine } from "@/lib/monitoring-data";
import { aircraftStatus, defectSeverity, defectStatus, engineStatus, fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Engineering Summary · Hermes" };

type EngineRow = {
  id: string;
  serial_number: string;
  status: string;
  ehi: number | null;
  oil_limit_qph?: number | null;
  engine_installations: { removed_at: string | null; position: number; aircraft: { registration: string } | null }[];
};

export default async function SummaryReport() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since6m = new Date(now.getTime() - 183 * 86_400_000).toISOString().slice(0, 10);

  const [aircraftRes, enginesRes, limitsRes, defectsRes, monitoring, plan, wosRes, partsRes] = await Promise.all([
    supabase.from("aircraft").select("id, registration, aircraft_type, status, total_hours").order("registration"),
    supabase
      .from("engines")
      .select("id, serial_number, status, ehi, engine_installations(removed_at, position, aircraft(registration))")
      .neq("status", "retired")
      .returns<EngineRow[]>(),
    supabase.from("engines").select("id, oil_limit_qph"),
    supabase
      .from("defects")
      .select("defect_no, reported_at, description, severity, status, aircraft(registration), engines(serial_number)")
      .neq("status", "closed")
      .order("reported_at")
      .returns<{ defect_no: string | null; reported_at: string; description: string; severity: string; status: string; aircraft: { registration: string } | null; engines: { serial_number: string } | null }[]>(),
    loadMonitoring(supabase, { since: since6m }),
    loadPlanner(supabase, today),
    supabase
      .from("work_orders")
      .select("wo_no, title, priority, status, due_date, aircraft(registration), engines(serial_number)")
      .in("status", WO_ACTIVE)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<{ wo_no: string | null; title: string; priority: string; status: string; due_date: string | null; aircraft: { registration: string } | null; engines: { serial_number: string } | null }[]>(),
    supabase.from("parts").select("*").order("part_number").returns<Part[]>(),
  ]);
  const overhaul = plan ? await loadOverhaulForecast(supabase, plan.rates, today) : [];

  const aircraft = aircraftRes.data ?? [];
  const engines = enginesRes.data ?? [];
  const defects = defectsRes.data ?? [];
  const ready = aircraft.filter((a) => a.status === "serviceable").length;
  const scored = engines.filter((e) => e.ehi != null);
  const avgEhi = scored.length ? Math.round(scored.reduce((s, e) => s + Number(e.ehi), 0) / scored.length) : null;
  const atRisk = scored.filter((e) => Number(e.ehi) < AT_RISK_EHI).sort((a, b) => Number(a.ehi) - Number(b.ehi));
  const where = (e: EngineRow) => {
    const i = e.engine_installations.find((x) => !x.removed_at);
    return i?.aircraft ? `${i.aircraft.registration} #${i.position}` : "Store";
  };

  const status = monitoring && !limitsRes.error
    ? statusByEngine(monitoring, new Map((limitsRes.data ?? []).map((r) => [r.id as string, r.oil_limit_qph as number | null])))
    : null;
  const findings = status
    ? engines.flatMap((e) => {
        const s = status.get(e.id);
        return s ? channels.filter((c) => s[c.key]?.level && s[c.key]?.level !== "normal").map((c) => ({ e, c, s, level: s[c.key]!.level! })) : [];
      })
    : [];

  const due = plan ? plan.tasks.filter((t) => t.due.state === "overdue" || t.due.state === "due_soon") : [];
  const wos = wosRes.error ? null : (wosRes.data ?? []);
  const parts = partsRes.error ? null : (partsRes.data ?? []);
  const short = parts?.filter((p) => stockState(p) !== "ok") ?? [];
  const horizon = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  const overhaulYear = overhaul.filter((e) => e.remaining <= 0 || (e.dueDate && e.dueDate <= horizon));

  return (
    <>
      <ReportToolbar />
      <ReportSheet
        kind="Engineering Summary"
        title="Engineering Summary Report"
        subtitle={`Fleet engineering status as at ${today}`}
        generatedAt={reportStamp(now)}
        generatedBy={user.name}
      >
        <RSection title="Key indicators">
          <RStats
            items={[
              { label: "Mission ready", value: `${ready}/${aircraft.length}`, color: ready < aircraft.length ? "var(--warning)" : "var(--success)" },
              { label: "Fleet average EHI", value: avgEhi ?? "—", color: avgEhi != null ? bandOf(avgEhi).color : undefined },
              { label: "Open defects", value: defects.length, color: defects.some((d) => d.severity === "critical") ? "var(--danger)" : undefined },
              { label: "Monitoring findings", value: status ? findings.length : "—", color: findings.some((f) => f.level === "alert") ? "var(--danger)" : undefined },
              { label: "Tasks overdue", value: plan ? due.filter((t) => t.due.state === "overdue").length : "—", color: "var(--danger)" },
              { label: "Tasks due ≤ 30 days", value: plan ? due.filter((t) => t.due.state === "due_soon").length : "—", color: "var(--warning)" },
              { label: "Active work orders", value: wos?.length ?? "—" },
              { label: "Stock shortfalls", value: parts ? short.length : "—", color: short.length ? "var(--warning)" : undefined },
            ]}
          />
        </RSection>

        <RSection title="Fleet readiness" note={`${aircraft.length} aircraft`}>
          <RTable
            head={["Aircraft", "Type", "Status", "Total FH"]}
            empty="No aircraft recorded."
            rows={aircraft.map((a) => [
              <span key="r" className={mono}>{a.registration}</span>,
              a.aircraft_type,
              <RStatus key="s" map={aircraftStatus} value={a.status} />,
              <span key="h" className={mono}>{fmtHours(a.total_hours)}</span>,
            ])}
          />
        </RSection>

        <RSection title="Engine health" note={`${engines.length} engines · at risk = EHI below ${AT_RISK_EHI}`}>
          <p className="mb-3">
            {Object.entries(engineStatus)
              .filter(([k]) => k !== "retired")
              .map(([k, m]) => `${m.label}: ${engines.filter((e) => e.status === k).length}`)
              .join(" · ")}
          </p>
          <RTable
            head={["Engine", "Location", "EHI", "Band"]}
            empty="No engines below the at-risk threshold."
            rows={atRisk.map((e) => [
              <span key="sn" className={mono}>{e.serial_number}</span>,
              <span key="l" className={mono}>{where(e)}</span>,
              <span key="h" className={mono}>{e.ehi}</span>,
              <span key="b" style={{ color: ink(bandOf(Number(e.ehi)).color) }}>{bandOf(Number(e.ehi)).label}</span>,
            ])}
          />
        </RSection>

        {status && (
          <RSection title="Condition monitoring findings" note="Latest record per channel, last 6 months">
            <RTable
              head={["Engine", "Location", "Channel", "Level", "Finding"]}
              empty="All monitoring channels normal."
              rows={findings
                .sort((a, b) => (a.level === b.level ? 0 : a.level === "alert" ? -1 : 1))
                .map((f) => [
                  <span key="sn" className={mono}>{f.e.serial_number}</span>,
                  <span key="l" className={mono}>{where(f.e)}</span>,
                  f.c.label,
                  <RStatus key="lv" map={monitorLevel} value={f.level} />,
                  <span key="d" className="block min-w-48">{describe(f.c.key, f.s)}</span>,
                ])}
            />
          </RSection>
        )}

        <RSection title="Open defects" note={Object.entries(defectSeverity).map(([k, m]) => `${m.label} ${defects.filter((d) => d.severity === k).length}`).join(" · ")}>
          <RTable
            head={["Defect", "Reported", "Asset", "Description", "Severity", "Status"]}
            empty="No open defects."
            rows={defects
              .filter((d) => d.severity !== "minor")
              .map((d) => [
                <span key="n" className={mono}>{d.defect_no ?? "—"}</span>,
                <span key="r" className={mono}>{d.reported_at}</span>,
                <span key="a" className={mono}>{[d.aircraft?.registration, d.engines?.serial_number].filter(Boolean).join(" · ")}</span>,
                <span key="d" className="block min-w-48">{d.description}</span>,
                <RStatus key="s" map={defectSeverity} value={d.severity} />,
                <RStatus key="st" map={defectStatus} value={d.status} />,
              ])}
          />
          {defects.some((d) => d.severity === "minor") && (
            <p className="mt-2 text-[11px] text-ink-muted">{defects.filter((d) => d.severity === "minor").length} minor defect(s) not listed.</p>
          )}
        </RSection>

        {plan && (
          <RSection title="Maintenance due" note="Overdue and due within 30 days">
            <RTable
              head={["Status", "Task", "Asset", "Projected due", "Work order"]}
              empty="No tasks overdue or due soon."
              rows={due.map((t) => [
                <RStatus key="s" map={dueState} value={t.due.state} />,
                <span key="t" className="block min-w-48">{t.title}{t.task_ref && <span className="text-ink-muted"> · {t.task_ref}</span>}</span>,
                <span key="a" className={mono}>{t.asset}</span>,
                <span key="d" className={mono}>{t.due.dueDate ?? "—"}</span>,
                <span key="w" className={mono}>{t.openWo?.wo_no ?? "Not raised"}</span>,
              ])}
            />
            <p className="mt-4 mb-2 font-medium">Engines reaching overhaul within 12 months</p>
            <RTable
              head={["Engine", "Location", "TSO", "Remaining FH", "Projected"]}
              empty="None."
              rows={overhaulYear.map((e) => [
                <span key="sn" className={mono}>{e.serial_number}</span>,
                <span key="l" className={mono}>{e.location}</span>,
                <span key="t" className={mono}>{fmtHours(e.tso)}</span>,
                <span key="r" className={mono}>{fmtHours(e.remaining)}</span>,
                <span key="d" className={mono}>{e.dueDate ?? "—"}</span>,
              ])}
            />
          </RSection>
        )}

        {wos && (
          <RSection title="Work in progress" note={Object.entries(woStatus).filter(([k]) => WO_ACTIVE.includes(k)).map(([k, m]) => `${m.label} ${wos.filter((w) => w.status === k).length}`).join(" · ")}>
            <RTable
              head={["WO", "Title", "Asset", "Priority", "Status", "Due"]}
              empty="No active work orders."
              rows={wos.map((w) => [
                <span key="n" className={mono}>{w.wo_no}</span>,
                <span key="t" className="block min-w-48">{w.title}</span>,
                <span key="a" className={mono}>{[w.aircraft?.registration, w.engines?.serial_number].filter(Boolean).join(" · ") || "—"}</span>,
                <RStatus key="p" map={woPriority} value={w.priority} />,
                <RStatus key="s" map={woStatus} value={w.status} />,
                <span key="d" className={mono} style={{ color: w.due_date && w.due_date < today ? "var(--warn-ink)" : undefined }}>{w.due_date ?? "—"}</span>,
              ])}
            />
          </RSection>
        )}

        {parts && (
          <RSection title="Supply" note="Items below reorder level or out of stock">
            <RTable
              head={["Part no.", "Description", "Location", "On hand", "Reorder", "Stock"]}
              empty="All items at or above reorder level."
              rows={short.map((p) => [
                <span key="pn" className={mono}>{p.part_number}</span>,
                <span key="d" className="block min-w-40">{p.description}</span>,
                p.location,
                <span key="q" className={mono}>{Number(p.quantity)} {p.unit}</span>,
                <span key="m" className={mono}>{Number(p.min_quantity)}</span>,
                <RStatus key="s" map={stockLevel} value={stockState(p)} />,
              ])}
            />
          </RSection>
        )}
      </ReportSheet>
    </>
  );
}
