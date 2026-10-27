import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { BarChart } from "@/components/bar-chart";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink, Chip, KpiCard, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { DUE_SOON_DAYS, dueState, intervalLabel, type DueState } from "@/lib/maintenance";
import { UTILISATION_DAYS, loadOverhaulForecast, loadPlanner, type PlannedTask } from "@/lib/maintenance-data";
import { fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Maintenance Planner · Hermes" };

const tabKeys = ["programme", "calendar", "overhaul"] as const;
const MONTHS_AHEAD = 12;

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const sp = (await searchParams) as { tab?: string; state?: string; q?: string };
  const tab = tabKeys.find((t) => t === sp.tab) ?? "programme";
  const state = sp.state && sp.state in dueState ? (sp.state as DueState) : "";
  const q = (sp.q ?? "").trim();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const plan = await loadPlanner(supabase, today);
  if (!plan) return <SetupNotice module="Maintenance Planner" file="0006_maintenance.sql" />;
  const overhaul = await loadOverhaulForecast(supabase, plan.rates, today);

  const { tasks } = plan;
  const by = (s: DueState) => tasks.filter((t) => t.due.state === s);
  const horizon = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  const overhaulYear = overhaul.filter((e) => e.remaining <= 0 || (e.dueDate && e.dueDate <= horizon));
  const editable = canEdit(user.role);

  const needle = q.toLowerCase();
  const shown = tasks.filter(
    (t) =>
      (!state || t.due.state === state) &&
      (!needle || [t.asset, t.aircraftReg, t.title, t.task_ref, t.ata_chapter].some((v) => v?.toLowerCase().includes(needle))),
  );

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tab !== "programme" && { tab }), ...(state && { state }), ...(q && { q }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/planner?${s}` : "/planner";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Maintenance"
        title="Maintenance Planner"
        description={`Maintenance programme, projected due dates (utilisation over the last ${UTILISATION_DAYS} days) and overhaul forecast.`}
        actions={
          editable && (
            <ButtonLink href="/planner/new" variant="primary">
              <Plus size={16} /> Add task
            </ButtonLink>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Overdue" value={by("overdue").length} hint="Past an hour, cycle or calendar limit" color={by("overdue").length ? "var(--danger)" : undefined} />
        <KpiCard label="Due soon" value={by("due_soon").length} hint={`Within ${DUE_SOON_DAYS} days or 10% of interval`} color="var(--warning)" />
        <KpiCard label="Work orders raised" value={tasks.filter((t) => t.openWo).length} hint="Due tasks with an open WO" color="var(--accent)" />
        <KpiCard label="Programme tasks" value={tasks.length} hint={`${new Set(tasks.map((t) => t.asset)).size} assets · ${by("no_baseline").length} without baseline`} />
        <KpiCard label="Overhauls — 12 months" value={overhaulYear.length} hint="Engines reaching TBO" color={overhaulYear.length ? "var(--gold)" : undefined} />
      </section>

      <Tabs
        active={tab}
        tabs={[
          { key: "programme", label: "Programme", href: link({ tab: "" }) },
          { key: "calendar", label: "Forecast calendar", href: link({ tab: "calendar" }) },
          { key: "overhaul", label: "Overhaul forecast", href: link({ tab: "overhaul" }) },
        ]}
      />

      {tab === "programme" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
              <Search size={15} className="text-muted" />
              <input name="q" defaultValue={q} placeholder="Search asset, task, reference, ATA…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
              {state && <input type="hidden" name="state" value={state} />}
            </form>
            <div className="flex flex-wrap gap-1.5">
              <Chip href={link({ state: "" })} active={!state}>All</Chip>
              {Object.entries(dueState).map(([k, m]) => (
                <Chip key={k} href={link({ state: k })} active={state === k} color={m.color}>
                  {m.label} <span className="font-mono text-muted">{by(k as DueState).length}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div className="panel overflow-hidden rounded-2xl">
            <TaskTable tasks={shown} editable={editable} />
          </div>
          <p className="font-mono text-xs text-muted">{shown.length} task(s) · sorted by urgency</p>
        </>
      )}

      {tab === "calendar" && <Calendar tasks={tasks} now={now} />}

      {tab === "overhaul" && (
        <div className="panel overflow-hidden rounded-2xl">
          <Table
            head={["Engine", "Location", "TSO", "TBO", "Life used", "Remaining", "Projected"]}
            empty="No engines with an overhaul interval."
            rows={overhaul.map((e) => {
              const used = Math.min(e.tso / e.interval, 1);
              const color = e.remaining <= 0 ? "var(--danger)" : e.remaining <= 300 ? "var(--warning)" : "var(--success)";
              return [
                <Link key="sn" href={`/engines/${encodeURIComponent(e.serial_number)}`} className="font-mono hover:text-gold-soft">{e.serial_number}</Link>,
                <span key="l" className="whitespace-nowrap font-mono text-muted">{e.location}</span>,
                <span key="t" className="font-mono">{fmtHours(e.tso)}</span>,
                <span key="i" className="font-mono text-muted">{fmtHours(e.interval)}</span>,
                <div key="u" className="flex min-w-40 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${used * 100}%`, background: color }} />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-muted">{Math.round(used * 100)}%</span>
                </div>,
                <span key="r" className="whitespace-nowrap font-mono" style={{ color }}>{fmtHours(e.remaining)} FH</span>,
                <span key="d" className="whitespace-nowrap font-mono text-muted">{e.dueDate ?? (e.location === "Store" ? "Not flying" : "—")}</span>,
              ];
            })}
          />
        </div>
      )}
    </div>
  );
}

function Remaining({ t }: { t: PlannedTask }) {
  const parts = [
    t.due.remainingHours != null && `${fmtHours(t.due.remainingHours)} FH`,
    t.due.remainingCycles != null && `${t.due.remainingCycles} cyc`,
    t.due.remainingDays != null && `${t.due.remainingDays} d`,
  ].filter(Boolean);
  return (
    <span className="whitespace-nowrap font-mono" style={{ color: t.due.state === "overdue" ? "var(--danger)" : undefined }}>
      {parts.join(" · ") || "—"}
    </span>
  );
}

function TaskTable({ tasks, editable }: { tasks: PlannedTask[]; editable: boolean }) {
  return (
    <Table
      head={["Status", "Task", "Asset", "Interval", "Last done", "Remaining", "Projected due", "Work order"]}
      empty="No tasks match."
      rows={tasks.map((t) => [
        <StatusBadge key="s" map={dueState} value={t.due.state} />,
        <Link key="t" href={`/planner/${t.id}`} className="block min-w-56 hover:text-gold-soft">
          {t.title}
          <span className="mt-0.5 block font-mono text-xs text-muted">{[t.task_ref, t.ata_chapter && `ATA ${t.ata_chapter}`].filter(Boolean).join(" · ")}</span>
        </Link>,
        <Link key="a" href={t.assetHref} className="whitespace-nowrap font-mono hover:text-gold-soft">
          {t.asset}
          {t.engine_id && <span className="block text-xs text-muted">{t.aircraftReg ?? "Store"}</span>}
        </Link>,
        <span key="i" className="whitespace-nowrap text-muted">{intervalLabel(t)}</span>,
        <span key="l" className="whitespace-nowrap font-mono text-muted">{t.last_done_date ?? "—"}</span>,
        <Remaining key="r" t={t} />,
        <span key="d" className="whitespace-nowrap font-mono">{t.due.dueDate ?? "—"}</span>,
        t.openWo ? (
          <Link key="w" href={`/work/${t.openWo.id}`} className="whitespace-nowrap font-mono text-accent hover:text-gold-soft">{t.openWo.wo_no}</Link>
        ) : editable && (t.due.state === "overdue" || t.due.state === "due_soon") ? (
          <Link key="w" href={`/work/new?task=${t.id}`} className="whitespace-nowrap rounded-md border border-gold/40 px-2 py-1 text-xs text-gold-soft hover:bg-gold/10">
            Raise WO
          </Link>
        ) : (
          <span key="w" className="text-muted">—</span>
        ),
      ])}
    />
  );
}

function Calendar({ tasks, now }: { tasks: PlannedTask[]; now: Date }) {
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) };
  });
  const thisMonth = months[0].key;
  // Overdue tasks are shown against the current month.
  const monthOf = (t: PlannedTask) => (t.due.dueDate ? (t.due.dueDate.slice(0, 7) < thisMonth ? thisMonth : t.due.dueDate.slice(0, 7)) : null);
  const grouped = months.map((m) => ({ ...m, tasks: tasks.filter((t) => monthOf(t) === m.key) }));

  return (
    <div className="space-y-6">
      <section className="panel rounded-2xl p-6">
        <p className="label">Tasks falling due per month</p>
        <p className="mt-1 text-xs text-muted">Projected from current utilisation; overdue tasks count in the current month.</p>
        <div className="mt-4">
          <BarChart points={grouped.map((m) => ({ label: m.label, value: m.tasks.length, detail: `${m.tasks.filter((t) => t.due.state === "overdue").length} overdue` }))} />
        </div>
      </section>

      {grouped.slice(0, 3).map((m) => (
        <section key={m.key} className="panel overflow-hidden rounded-2xl">
          <div className="flex items-baseline justify-between px-6 pt-6">
            <p className="label !text-gold">{new Date(`${m.key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
            <p className="font-mono text-xs text-muted">{m.tasks.length} task(s)</p>
          </div>
          <div className="mt-3">
            <Table
              head={["Due", "Status", "Task", "Asset", "Work order"]}
              empty="Nothing due."
              rows={m.tasks.map((t) => [
                <span key="d" className="whitespace-nowrap font-mono">{t.due.dueDate}</span>,
                <StatusBadge key="s" map={dueState} value={t.due.state} />,
                <Link key="t" href={`/planner/${t.id}`} className="block min-w-56 hover:text-gold-soft">{t.title}</Link>,
                <Link key="a" href={t.assetHref} className="whitespace-nowrap font-mono hover:text-gold-soft">{t.asset}</Link>,
                t.openWo ? (
                  <Link key="w" href={`/work/${t.openWo.id}`} className="font-mono text-accent hover:text-gold-soft">{t.openWo.wo_no}</Link>
                ) : (
                  <span key="w" className="text-muted">—</span>
                ),
              ])}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
