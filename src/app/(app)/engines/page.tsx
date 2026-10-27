import Link from "next/link";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import { ehiTone } from "@/components/charts";
import { ButtonLink, Chip, PageHeader, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { friendlyError } from "@/lib/db-errors";
import { engineStatus, fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Engines · Hermes" };

const sorts = {
  serial: { label: "Serial", column: "serial_number", ascending: true },
  ehi: { label: "Lowest EHI", column: "ehi", ascending: true },
  tso: { label: "Highest TSO", column: "tso", ascending: false },
} as const;

type Row = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  tsn: number;
  tso: number | null;
  overhaul_interval_hours: number | null;
  ehi: number | null;
  engine_installations: { position: number; removed_at: string | null; aircraft: { registration: string } | null }[];
};

export default async function EnginesPage({ searchParams }: PageProps<"/engines">) {
  const sp = (await searchParams) as { q?: string; status?: string; sort?: string };
  const q = sp.q ?? "";
  const status = sp.status ?? "";
  const sortKey = (sp.sort && sp.sort in sorts ? sp.sort : "serial") as keyof typeof sorts;
  const sort = sorts[sortKey];

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);

  let query = supabase
    .from("engines")
    .select("id, serial_number, model, status, tsn, tso, overhaul_interval_hours, ehi, engine_installations(position, removed_at, aircraft(registration))")
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false });
  if (status) query = query.eq("status", status);
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`serial_number.ilike.%${term}%,model.ilike.%${term}%`);

  const { data, error } = await query.returns<Row[]>();
  const engines = data ?? [];

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(sortKey !== "serial" && { sort: sortKey }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/engines?${s}` : "/engines";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Engineering"
        title="Engine Passport"
        description="Complete digital identity and life history of every engine."
        actions={
          canEdit(user.role) && (
            <ButtonLink href="/engines/new" variant="primary">
              <Plus size={16} /> New engine
            </ButtonLink>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
          <Search size={15} className="text-muted" />
          <input name="q" defaultValue={q} placeholder="Search serial or model…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          {status && <input type="hidden" name="status" value={status} />}
          {sortKey !== "serial" && <input type="hidden" name="sort" value={sortKey} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Chip href={link({ status: "" })} active={!status}>All</Chip>
          {Object.entries(engineStatus).map(([k, m]) => (
            <Chip key={k} href={link({ status: k })} active={status === k} color={m.color}>{m.label}</Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp size={14} className="text-muted" />
          {Object.entries(sorts).map(([k, s]) => (
            <Chip key={k} href={link({ sort: k === "serial" ? "" : k })} active={sortKey === k}>{s.label}</Chip>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{friendlyError(error)}</p>}

      <div className="panel overflow-hidden rounded-2xl">
        <Table
          head={["Serial no.", "Model", "Location", "EHI", "TSN (FH)", "TSO (FH)", "To overhaul", "Status"]}
          empty="No engines match."
          rows={engines.map((e) => {
            const inst = e.engine_installations.find((i) => !i.removed_at);
            const tone = ehiTone(e.ehi);
            const remaining = e.overhaul_interval_hours && e.tso != null ? e.overhaul_interval_hours - e.tso : null;
            return [
              <Link key="sn" href={`/engines/${encodeURIComponent(e.serial_number)}`} className="font-mono text-foreground hover:text-gold-soft">
                {e.serial_number}
              </Link>,
              <span key="m" className="text-muted">{e.model}</span>,
              inst?.aircraft ? (
                <Link key="l" href={`/fleet/${encodeURIComponent(inst.aircraft.registration)}`} className="font-mono hover:text-gold-soft">
                  {inst.aircraft.registration} <span className="text-muted">#{inst.position}</span>
                </Link>
              ) : (
                <span key="l" className="text-muted">Store</span>
              ),
              <span key="ehi" className="font-mono" style={{ color: tone.color }}>{e.ehi ?? "—"}</span>,
              <span key="tsn" className="font-mono text-muted">{fmtHours(e.tsn)}</span>,
              <span key="tso" className="font-mono text-muted">{fmtHours(e.tso)}</span>,
              <span key="r" className={`font-mono ${remaining != null && remaining <= 200 ? "text-warning" : "text-muted"}`}>
                {remaining == null ? "—" : fmtHours(remaining)}
              </span>,
              <StatusBadge key="st" map={engineStatus} value={e.status} />,
            ];
          })}
        />
      </div>
      <p className="font-mono text-xs text-muted">{engines.length} engine(s)</p>
    </div>
  );
}

