import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { ButtonLink, Chip, PageHeader, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { DEFECT_COLUMNS, daysBetween, type DefectRecord } from "@/lib/defects";
import { friendlyError } from "@/lib/db-errors";
import { defectSeverity, defectStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/setup-notice";

export const metadata = { title: "Defects · Hermes" };

export default async function DefectsPage({ searchParams }: PageProps<"/defects">) {
  const sp = (await searchParams) as { q?: string; status?: string; severity?: string };
  const q = sp.q ?? "";
  const status = sp.status && (sp.status in defectStatus || sp.status === "all") ? sp.status : "active";
  const severity = sp.severity && sp.severity in defectSeverity ? sp.severity : "";

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  let query = supabase.from("defects").select(DEFECT_COLUMNS).order("reported_at", { ascending: false }).limit(300);
  if (status === "active") query = query.neq("status", "closed");
  else if (status !== "all") query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`defect_no.ilike.%${term}%,description.ilike.%${term}%,system.ilike.%${term}%,ata_chapter.ilike.%${term}%,failure_mode.ilike.%${term}%`);

  const [list, open, closed30] = await Promise.all([
    query.returns<DefectRecord[]>(),
    supabase.from("defects").select("severity, status, reported_at, deferred_until").neq("status", "closed"),
    supabase.from("defects").select("id", { count: "exact", head: true }).eq("status", "closed").gte("closed_at", since30d),
  ]);

  if (list.error?.code === "42703") return <SetupNotice />;
  const defects = list.data ?? [];
  const openRows = open.data ?? [];
  const avgAge = openRows.length ? Math.round(openRows.reduce((s, d) => s + daysBetween(d.reported_at, today), 0) / openRows.length) : 0;
  const overdueDeferrals = openRows.filter((d) => d.status === "deferred" && d.deferred_until && d.deferred_until < today).length;

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status !== "active" && { status }), ...(severity && { severity }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/defects?${s}` : "/defects";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Engineering"
        title="Defect Management"
        description="Record, classify and track defects to closure."
        actions={
          canEdit(user.role) && (
            <ButtonLink href="/defects/new" variant="primary">
              <Plus size={16} /> Raise defect
            </ButtonLink>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Open defects" value={openRows.length} hint="Open, in work or deferred" />
        <Kpi label="Critical open" value={openRows.filter((d) => d.severity === "critical").length} hint="Severity critical" color="var(--danger)" />
        <Kpi label="Deferred" value={openRows.filter((d) => d.status === "deferred").length} hint={`${overdueDeferrals} past deferral date`} color={overdueDeferrals ? "var(--warning)" : undefined} />
        <Kpi label="Average open age" value={avgAge} hint="Days since reported" unit="d" />
        <Kpi label="Closed — 30 days" value={closed30.count ?? 0} hint="Rectified defects" color="var(--success)" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
          <Search size={15} className="text-muted" />
          <input name="q" defaultValue={q} placeholder="Search no., description, ATA, system, failure mode…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          {status !== "active" && <input type="hidden" name="status" value={status} />}
          {severity && <input type="hidden" name="severity" value={severity} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Chip href={link({ status: "" })} active={status === "active"}>Active</Chip>
          {Object.entries(defectStatus).map(([k, m]) => (
            <Chip key={k} href={link({ status: k })} active={status === k} color={m.color}>{m.label}</Chip>
          ))}
          <Chip href={link({ status: "all" })} active={status === "all"}>All</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(defectSeverity).map(([k, m]) => (
            <Chip key={k} href={link({ severity: severity === k ? "" : k })} active={severity === k} color={m.color}>{m.label}</Chip>
          ))}
        </div>
      </div>

      {list.error && <p className="text-sm text-danger">{friendlyError(list.error)}</p>}

      <div className="panel overflow-hidden rounded-2xl">
        <Table
          head={["Defect no.", "Reported", "Aircraft", "Engine", "ATA", "Description", "Failure mode", "Severity", "Status", "Age"]}
          empty="No defects match."
          rows={defects.map((d) => {
            const overdue = d.status === "deferred" && d.deferred_until && d.deferred_until < today;
            return [
              <Link key="no" href={`/defects/${d.id}`} className="whitespace-nowrap font-mono text-foreground hover:text-gold-soft">
                {d.defect_no ?? "—"}
              </Link>,
              <span key="r" className="whitespace-nowrap font-mono text-muted">{d.reported_at}</span>,
              <span key="a" className="font-mono">{d.aircraft?.registration ?? "—"}</span>,
              <span key="e" className="font-mono">{d.engines?.serial_number ?? "—"}</span>,
              <span key="ata" className="font-mono text-muted">{d.ata_chapter ?? "—"}</span>,
              <Link key="d" href={`/defects/${d.id}`} className="block min-w-64 hover:text-gold-soft">{d.description}</Link>,
              <span key="f" className="whitespace-nowrap text-muted">{d.failure_mode ?? "—"}</span>,
              <StatusBadge key="s" map={defectSeverity} value={d.severity} />,
              <span key="st" className="flex items-center gap-1.5 whitespace-nowrap">
                <StatusBadge map={defectStatus} value={d.status} />
                {overdue && <span className="text-[11px] text-warning">overdue</span>}
              </span>,
              <span key="age" className="whitespace-nowrap font-mono text-muted">
                {daysBetween(d.reported_at, d.closed_at ?? today)}d
              </span>,
            ];
          })}
        />
      </div>
      <p className="font-mono text-xs text-muted">{defects.length} defect(s){defects.length === 300 ? " — showing latest 300" : ""}</p>
    </div>
  );
}

function Kpi({ label, value, hint, color, unit }: { label: string; value: number; hint: string; color?: string; unit?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <p className="label">{label}</p>
      <p className="mt-4 font-mono text-4xl font-medium tabular-nums" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-1 text-lg text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
