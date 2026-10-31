import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink, Chip, KpiCard, PageHeader, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { friendlyError, isMissingSchema } from "@/lib/db-errors";
import { WO_ACTIVE, WO_COLUMNS, isWoOverdue, woKind, woPriority, woStatus, type WorkOrder } from "@/lib/maintenance";
import { fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";

export const metadata = { title: "Work Management" };

export default async function WorkPage({ searchParams }: PageProps<"/work">) {
  const sp = (await searchParams) as { q?: string; status?: string; priority?: string };
  const q = sp.q ?? "";
  const status = sp.status && (sp.status in woStatus || sp.status === "all") ? sp.status : "active";
  const priority = sp.priority && sp.priority in woPriority ? sp.priority : "";

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = await requestNow();
  const today = isoDate(now);
  const since30d = isoDate(new Date(now.getTime() - 30 * 86_400_000));

  let query = supabase.from("work_orders").select(WO_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (status === "active") query = query.in("status", WO_ACTIVE);
  else if (status !== "all") query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`wo_no.ilike.%${term}%,title.ilike.%${term}%,assigned_to.ilike.%${term}%`);

  const [list, active, done30] = await Promise.all([
    query.returns<WorkOrder[]>(),
    supabase.from("work_orders").select("status, priority, due_date, est_hours").in("status", WO_ACTIVE),
    supabase.from("work_orders").select("actual_hours").eq("status", "completed").gte("completed_at", since30d),
  ]);

  if (isMissingSchema(list.error))
    return <SetupNotice module="Work Management" file="0006_maintenance.sql" />;

  const rows = list.data ?? [];
  const activeRows = active.data ?? [];
  const overdue = activeRows.filter((w) => isWoOverdue(w, today)).length;
  const backlogHours = activeRows.reduce((s, w) => s + Number(w.est_hours ?? 0), 0);
  const doneHours = (done30.data ?? []).reduce((s, w) => s + Number(w.actual_hours ?? 0), 0);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status !== "active" && { status }), ...(priority && { priority }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/work?${s}` : "/work";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Maintenance"
        title="Work Management"
        description="Work orders, task cards and parts used."
        actions={
          canEdit(user.role) && (
            <ButtonLink href="/work/new" variant="primary">
              <Plus size={16} /> New work order
            </ButtonLink>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Active work orders" value={activeRows.length} hint={`${activeRows.filter((w) => w.status === "in_progress").length} in progress`} />
        <KpiCard label="AOG" value={activeRows.filter((w) => w.priority === "aog").length} hint="Aircraft on ground" color="var(--danger)" />
        <KpiCard label="Awaiting parts" value={activeRows.filter((w) => w.status === "awaiting_parts").length} hint="Blocked on supply" color="var(--warning)" />
        <KpiCard label="Overdue" value={overdue} hint="Past due date" color={overdue ? "var(--warning)" : undefined} />
        <KpiCard label="Backlog" value={fmtHours(backlogHours)} unit="mh" hint={`${fmtHours(doneHours)} mh completed in 30 days`} />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
          <Search size={15} className="text-muted" />
          <input name="q" defaultValue={q} placeholder="Search WO no., title, assignee…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          {status !== "active" && <input type="hidden" name="status" value={status} />}
          {priority && <input type="hidden" name="priority" value={priority} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Chip href={link({ status: "" })} active={status === "active"}>Active</Chip>
          {Object.entries(woStatus).map(([k, m]) => (
            <Chip key={k} href={link({ status: k })} active={status === k} color={m.color}>{m.label}</Chip>
          ))}
          <Chip href={link({ status: "all" })} active={status === "all"}>All</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(woPriority).map(([k, m]) => (
            <Chip key={k} href={link({ priority: priority === k ? "" : k })} active={priority === k} color={m.color}>{m.label}</Chip>
          ))}
        </div>
      </div>

      {list.error && <p className="text-sm text-danger">{friendlyError(list.error)}</p>}

      <div className="panel overflow-hidden rounded-2xl">
        <Table
          head={["WO no.", "Title", "Type", "Asset", "Priority", "Status", "Due", "Assigned", "Man-hours"]}
          empty="No work orders match."
          rows={rows.map((w) => [
            <Link key="no" href={`/work/${w.id}`} className="whitespace-nowrap font-mono hover:text-gold-soft">{w.wo_no ?? "—"}</Link>,
            <Link key="t" href={`/work/${w.id}`} className="block min-w-64 hover:text-gold-soft">
              {w.title}
              {(w.defects || w.maintenance_tasks) && (
                <span className="mt-0.5 block text-xs text-muted">
                  {w.defects ? `Defect ${w.defects.defect_no ?? ""}` : `Task ${w.maintenance_tasks?.task_ref ?? w.maintenance_tasks?.title}`}
                </span>
              )}
            </Link>,
            <span key="k" className="whitespace-nowrap text-muted">{woKind[w.kind]?.label ?? w.kind}</span>,
            <span key="a" className="whitespace-nowrap font-mono">{[w.aircraft?.registration, w.engines?.serial_number].filter(Boolean).join(" · ") || "—"}</span>,
            <StatusBadge key="p" map={woPriority} value={w.priority} />,
            <StatusBadge key="s" map={woStatus} value={w.status} />,
            <span key="d" className={`whitespace-nowrap font-mono ${isWoOverdue(w, today) ? "text-warning" : "text-muted"}`}>
              {w.due_date ?? "—"}
              {isWoOverdue(w, today) && <span className="ml-1.5 font-sans text-[11px]">overdue</span>}
            </span>,
            <span key="as" className="whitespace-nowrap text-muted">{w.assigned_to ?? "—"}</span>,
            <span key="h" className="whitespace-nowrap font-mono text-muted">
              {w.actual_hours != null ? fmtHours(w.actual_hours) : "—"} / {w.est_hours != null ? fmtHours(w.est_hours) : "—"}
            </span>,
          ])}
        />
      </div>
      <p className="font-mono text-xs text-muted">
        {rows.length} work order(s){rows.length === 300 ? " — showing latest 300" : ""} · man-hours shown as actual / estimate
      </p>
    </div>
  );
}
