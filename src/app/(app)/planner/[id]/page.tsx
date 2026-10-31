import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { dueState, intervalLabel, woStatus } from "@/lib/maintenance";
import { UTILISATION_DAYS, loadPlanner } from "@/lib/maintenance-data";
import { fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";
import { TaskForm } from "../forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TaskPage({ params }: PageProps<"/planner/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const today = isoDate(await requestNow());
  const [plan, wos] = await Promise.all([
    loadPlanner(supabase, today, { taskId: id, includeInactive: true }),
    supabase
      .from("work_orders")
      .select("id, wo_no, title, status, due_date, completed_at, completion_notes")
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!plan) return <SetupNotice module="Maintenance Planner" file="0006_maintenance.sql" />;
  const t = plan.tasks[0];
  if (!t) notFound();

  const editable = canEdit(user.role);
  const meta = dueState[t.due.state];
  const driver = { hours: "flight hours", cycles: "cycles", days: "calendar" }[t.due.driver ?? "days"];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/planner" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Maintenance Planner
      </Link>

      <section className="panel rounded-2xl p-6 md:p-8">
        <p className="label !text-gold">Programme task {t.task_ref && `· ${t.task_ref}`}</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
          {t.title}
          <StatusBadge map={dueState} value={t.due.state} />
          {!t.active && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">INACTIVE</span>}
        </h1>
        <p className="mt-3 text-sm">
          <Link href={t.assetHref} className="font-mono hover:text-gold-soft">{t.asset}</Link>
          {t.engine_id && <span className="text-muted"> · fitted to {t.aircraftReg ?? "— (in store)"}</span>}
          {t.ata_chapter && <span className="text-muted"> · ATA {t.ata_chapter}</span>}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 text-sm md:grid-cols-5">
          <Item label="Interval" value={intervalLabel(t)} />
          <Item label="Last done" value={[t.last_done_date, t.last_done_hours != null && `${fmtHours(t.last_done_hours)} FH`].filter(Boolean).join(" · ") || null} mono />
          <Item
            label="Remaining"
            value={[
              t.due.remainingHours != null && `${fmtHours(t.due.remainingHours)} FH`,
              t.due.remainingCycles != null && `${t.due.remainingCycles} cyc`,
              t.due.remainingDays != null && `${t.due.remainingDays} d`,
            ].filter(Boolean).join(" · ") || null}
            mono
            color={meta.color}
          />
          <Item label="Projected due" value={t.due.dueDate} mono color={meta.color} />
          <Item label="Driven by" value={t.due.driver ? `${driver} limit` : null} />
        </dl>
        <p className="mt-4 text-xs text-muted">Hour and cycle limits are projected using the aircraft&apos;s average utilisation over the last {UTILISATION_DAYS} days.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel h-fit overflow-hidden rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <p className="label">Work orders</p>
            {editable && !t.openWo && (
              <ButtonLink href={`/work/new?task=${t.id}`}>
                <Plus size={14} /> Raise WO
              </ButtonLink>
            )}
          </div>
          <div className="mt-3">
            <Table
              head={["WO no.", "Status", "Due", "Completed", "Work carried out"]}
              empty="No work orders yet. Raise one to carry out the task — completing it records compliance."
              rows={(wos.data ?? []).map((w) => [
                <Link key="n" href={`/work/${w.id}`} className="whitespace-nowrap font-mono hover:text-gold-soft">{w.wo_no}</Link>,
                <StatusBadge key="s" map={woStatus} value={w.status} />,
                <span key="d" className="whitespace-nowrap font-mono text-muted">{w.due_date ?? "—"}</span>,
                <span key="c" className="whitespace-nowrap font-mono text-muted">{w.completed_at ?? "—"}</span>,
                <span key="x" className="block min-w-48 text-muted">{w.completion_notes ?? "—"}</span>,
              ])}
            />
          </div>
        </section>

        {editable && (
          <section className="panel h-fit rounded-2xl p-6">
            <p className="label mb-5">Edit task</p>
            <TaskForm task={t} today={today} compact />
          </section>
        )}
      </div>
    </div>
  );
}

function Item({ label, value, mono, color }: { label: string; value: string | null; mono?: boolean; color?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 ${mono ? "font-mono" : ""}`} style={color ? { color } : undefined}>{value ?? "—"}</dd>
    </div>
  );
}
