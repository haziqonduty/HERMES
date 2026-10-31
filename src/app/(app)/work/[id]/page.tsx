import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Cog, Plane, ShieldAlert } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { isMissingSchema } from "@/lib/db-errors";
import { WO_ACTIVE, WO_COLUMNS, fmtQty, isWoOverdue, movementKind, woKind, woPriority, woStatus, type WorkOrder } from "@/lib/maintenance";
import { defectStatus, fmtHours } from "@/lib/status";
import { loadParts } from "@/lib/maintenance-data";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";
import { toggleStep } from "../actions";
import { AddStepForm, IssuePartForm, WorkOrderUpdateForm } from "../forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Step = {
  id: string;
  seq: number;
  instruction: string;
  done: boolean;
  done_at: string | null;
  profiles: { full_name: string | null; rank: string | null } | null;
};
type Movement = {
  id: string;
  moved_at: string;
  kind: string;
  quantity: number;
  parts: { id: string; part_number: string; description: string; unit: string } | null;
};

export default async function WorkOrderPage({ params }: PageProps<"/work/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data: w, error } = await supabase.from("work_orders").select(WO_COLUMNS).eq("id", id).returns<WorkOrder[]>().maybeSingle();
  if (isMissingSchema(error)) return <SetupNotice module="Work Management" file="0006_maintenance.sql" />;
  if (!w) notFound();

  const [stepsRes, movesRes, partsRes] = await Promise.all([
    supabase.from("work_order_steps").select("id, seq, instruction, done, done_at, profiles(full_name, rank)").eq("work_order_id", id).order("seq").returns<Step[]>(),
    supabase
      .from("stock_movements")
      .select("id, moved_at, kind, quantity, parts(id, part_number, description, unit)")
      .eq("work_order_id", id)
      .order("created_at")
      .returns<Movement[]>(),
    loadParts(supabase),
  ]);
  const steps = stepsRes.data ?? [];
  const moves = movesRes.data ?? [];

  const today = isoDate(await requestNow());
  const editable = canEdit(user.role);
  const active = WO_ACTIVE.includes(w.status);
  const doneSteps = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All work orders
      </Link>

      <section className="panel rounded-2xl p-6 md:p-8">
        <p className="label !text-gold">Work order · {woKind[w.kind]?.label ?? w.kind}</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-mono text-3xl font-semibold tracking-wider">
          {w.wo_no ?? "—"}
          <StatusBadge map={woPriority} value={w.priority} />
          <StatusBadge map={woStatus} value={w.status} />
          {isWoOverdue(w, today) && <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs text-warning">OVERDUE</span>}
        </h1>
        <p className="mt-4 max-w-3xl text-lg">{w.title}</p>
        {w.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted">{w.description}</p>}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {w.aircraft && (
            <Link href={`/fleet/${encodeURIComponent(w.aircraft.registration)}`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <Plane size={14} className="text-accent" /> <span className="font-mono">{w.aircraft.registration}</span>
            </Link>
          )}
          {w.engines && (
            <Link href={`/engines/${encodeURIComponent(w.engines.serial_number)}`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <Cog size={14} className="text-gold" /> <span className="font-mono">{w.engines.serial_number}</span>
            </Link>
          )}
          {w.defects && w.defect_id && (
            <Link href={`/defects/${w.defect_id}`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <ShieldAlert size={14} className="text-danger" />
              <span className="font-mono">{w.defects.defect_no}</span>
              <StatusBadge map={defectStatus} value={w.defects.status} />
            </Link>
          )}
          {w.maintenance_tasks && w.task_id && (
            <Link href={`/planner/${w.task_id}`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <CalendarClock size={14} className="text-accent" />
              {[w.maintenance_tasks.task_ref, w.maintenance_tasks.title].filter(Boolean).join(" · ")}
            </Link>
          )}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 text-sm md:grid-cols-5">
          <Item label="Raised" value={w.created_at.slice(0, 10)} />
          <Item label="Due" value={w.due_date} />
          <Item label="Started" value={w.started_at} />
          <Item label={w.status === "cancelled" ? "Cancelled" : "Completed"} value={w.completed_at} />
          <Item label="Man-hours (act / est)" value={`${w.actual_hours != null ? fmtHours(w.actual_hours) : "—"} / ${w.est_hours != null ? fmtHours(w.est_hours) : "—"}`} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="panel rounded-2xl p-6">
            <div className="flex items-baseline justify-between">
              <p className="label">Task card</p>
              <p className="font-mono text-xs text-muted">{doneSteps}/{steps.length} signed off</p>
            </div>
            {steps.length > 0 && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-success" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
              </div>
            )}
            <ol className="mt-5 space-y-2">
              {steps.map((s) => (
                <li key={s.id} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                  <form action={toggleStep}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="done" value={String(!s.done)} />
                    <button
                      type="submit"
                      disabled={!editable || !active}
                      aria-label={s.done ? `Reopen step ${s.seq}` : `Sign off step ${s.seq}`}
                      className={`mt-0.5 grid h-5 w-5 place-items-center rounded border transition disabled:cursor-not-allowed ${
                        s.done ? "border-success bg-success/20 text-success" : "border-border hover:border-gold/60"
                      }`}
                    >
                      {s.done && <Check size={13} />}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${s.done ? "text-muted line-through decoration-muted/50" : ""}`}>
                      <span className="mr-2 font-mono text-xs text-muted">{s.seq}.</span>
                      {s.instruction}
                    </p>
                    {s.done && s.done_at && (
                      <p className="mt-0.5 text-xs text-success/80">
                        Signed off {[s.profiles?.rank, s.profiles?.full_name].filter(Boolean).join(" ") || ""} · {s.done_at.slice(0, 16).replace("T", " ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {steps.length === 0 && <li className="text-sm text-muted">No task-card steps.</li>}
            </ol>
            {editable && active && (
              <div className="mt-4">
                <AddStepForm workOrderId={w.id} />
              </div>
            )}
          </section>

          <section className="panel overflow-hidden rounded-2xl">
            <p className="label px-6 pt-6">Parts used</p>
            <div className="mt-3">
              <Table
                head={["Date", "Part no.", "Description", "Movement", "Qty"]}
                empty="No parts issued to this work order."
                rows={moves.map((m) => [
                  <span key="d" className="whitespace-nowrap font-mono text-muted">{m.moved_at}</span>,
                  m.parts ? (
                    <Link key="p" href={`/inventory/${m.parts.id}`} className="whitespace-nowrap font-mono hover:text-gold-soft">{m.parts.part_number}</Link>
                  ) : "—",
                  <span key="ds" className="block min-w-48">{m.parts?.description}</span>,
                  <StatusBadge key="k" map={movementKind} value={m.kind} />,
                  <span key="q" className="whitespace-nowrap font-mono">{fmtQty(-m.quantity)} {m.parts?.unit}</span>,
                ])}
              />
            </div>
          </section>
        </div>

        {editable && (
          <div className="space-y-6">
            <section className="panel h-fit rounded-2xl p-6">
              <p className="label mb-5">Update work order</p>
              <WorkOrderUpdateForm wo={w} hasDefect={!!w.defect_id} defectOpen={!!w.defects && w.defects.status !== "closed"} />
            </section>
            {active && (
              <section className="panel h-fit rounded-2xl p-6">
                <p className="label mb-5">Issue / return parts</p>
                <IssuePartForm workOrderId={w.id} woNo={w.wo_no ?? ""} parts={partsRes.data ?? []} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono">{value ?? "—"}</dd>
    </div>
  );
}
