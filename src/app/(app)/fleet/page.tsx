import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { ehiTone } from "@/components/charts";
import { ButtonLink, Chip, PageHeader, StatusBadge } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { friendlyError } from "@/lib/db-errors";
import { aircraftStatus, fmtHours, fmtInt } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Fleet Overview" };

type Row = {
  id: string;
  registration: string;
  aircraft_type: string;
  squadron: string | null;
  base: string | null;
  status: string;
  total_hours: number;
  total_cycles: number;
  engine_positions: number;
  engine_installations: { position: number; removed_at: string | null; engines: { serial_number: string; ehi: number | null } | null }[];
};

export default async function FleetPage({ searchParams }: PageProps<"/fleet">) {
  const { q = "", status = "" } = (await searchParams) as { q?: string; status?: string };
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);

  let query = supabase
    .from("aircraft")
    .select(
      "id, registration, aircraft_type, squadron, base, status, total_hours, total_cycles, engine_positions, engine_installations(position, removed_at, engines(serial_number, ehi))",
    )
    .order("registration");
  if (status) query = query.eq("status", status);
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`registration.ilike.%${term}%,aircraft_type.ilike.%${term}%,squadron.ilike.%${term}%`);

  const { data, error } = await query.returns<Row[]>();
  const aircraft = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Engineering"
        title="Fleet Overview"
        description="Aircraft, installed engines and serviceability."
        actions={
          canEdit(user.role) && (
            <ButtonLink href="/fleet/new" variant="primary">
              <Plus size={16} /> Add aircraft
            </ButtonLink>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
          <Search size={15} className="text-muted" />
          <input name="q" defaultValue={q} placeholder="Search tail, type or squadron…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Chip href={q ? `/fleet?q=${encodeURIComponent(q)}` : "/fleet"} active={!status}>All</Chip>
          {Object.entries(aircraftStatus).map(([key, meta]) => (
            <Chip key={key} href={`/fleet?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} active={status === key} color={meta.color}>
              {meta.label}
            </Chip>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{friendlyError(error)}</p>}

      {aircraft.length === 0 ? (
        <div className="panel rounded-2xl p-12 text-center text-muted">No aircraft match.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {aircraft.map((a) => {
            const fitted = new Map(
              a.engine_installations.filter((i) => !i.removed_at).map((i) => [i.position, i.engines]),
            );
            return (
              <Link
                key={a.id}
                href={`/fleet/${encodeURIComponent(a.registration)}`}
                className="panel group rounded-2xl p-5 transition hover:!border-gold/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xl font-semibold tracking-wider transition group-hover:text-gold-soft">{a.registration}</p>
                    <p className="text-sm text-muted">
                      {a.aircraft_type}
                      {a.squadron && ` · ${a.squadron}`}
                    </p>
                  </div>
                  <StatusBadge map={aircraftStatus} value={a.status} />
                </div>

                <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${a.engine_positions}, minmax(0, 1fr))` }}>
                  {Array.from({ length: a.engine_positions }, (_, i) => i + 1).map((pos) => {
                    const e = fitted.get(pos);
                    const tone = ehiTone(e?.ehi ?? null);
                    return (
                      <div
                        key={pos}
                        className="rounded-lg border px-2 py-2 text-center"
                        style={{ borderColor: e ? `color-mix(in srgb, ${tone.color} 40%, transparent)` : "var(--border)" }}
                      >
                        <p className="font-mono text-[10px] text-muted">#{pos}</p>
                        <p className="font-mono text-sm" style={{ color: e ? tone.color : "var(--muted)" }}>
                          {e ? (e.ehi ?? "—") : "EMPTY"}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-between border-t border-border pt-3 font-mono text-xs text-muted">
                  <span>{fmtHours(a.total_hours)} FH</span>
                  <span>{fmtInt(a.total_cycles)} CYC</span>
                  <span>{a.base ?? "—"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

