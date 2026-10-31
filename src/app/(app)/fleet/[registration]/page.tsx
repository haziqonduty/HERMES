import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plane } from "lucide-react";
import { ehiTone } from "@/components/charts";
import { ButtonLink, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { aircraftStatus, defectSeverity, defectStatus, fmtHours, fmtInt } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";
import { FlightLogForm, InstallForm, RemoveForm } from "../forms";

type Installation = {
  id: string;
  position: number;
  installed_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  engines: { id: string; serial_number: string; model: string; ehi: number | null; tso: number | null; overhaul_interval_hours: number | null } | null;
};

export default async function AircraftPage({ params }: PageProps<"/fleet/[registration]">) {
  const registration = decodeURIComponent((await params).registration);
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);

  const { data: a } = await supabase.from("aircraft").select("*").eq("registration", registration).maybeSingle();
  if (!a) notFound();

  const [installs, flights, defects, spares] = await Promise.all([
    supabase
      .from("engine_installations")
      .select("id, position, installed_at, removed_at, removal_reason, engines(id, serial_number, model, ehi, tso, overhaul_interval_hours)")
      .eq("aircraft_id", a.id)
      .order("installed_at", { ascending: false })
      .returns<Installation[]>(),
    supabase.from("flight_logs").select("id, flight_date, flight_hours, cycles, sortie_ref").eq("aircraft_id", a.id).order("flight_date", { ascending: false }).limit(10),
    supabase.from("defects").select("id, reported_at, description, severity, status").eq("aircraft_id", a.id).neq("status", "closed").order("reported_at", { ascending: false }),
    supabase.from("engines").select("id, serial_number, model").eq("status", "spare").order("serial_number"),
  ]);

  const editable = canEdit(user.role);
  const today = (await requestNow()).toISOString().slice(0, 10);
  const active = new Map((installs.data ?? []).filter((i) => !i.removed_at).map((i) => [i.position, i]));
  const history = (installs.data ?? []).filter((i) => i.removed_at);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/fleet" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Fleet Overview
      </Link>

      <PageHeader
        eyebrow={`${a.aircraft_type}${a.squadron ? ` · ${a.squadron}` : ""}`}
        title={
          <span className="flex items-center gap-3 font-mono tracking-wider">
            <Plane size={26} className="text-gold" /> {a.registration}
          </span>
        }
        actions={
          <>
            <StatusBadge map={aircraftStatus} value={a.status} />
            {editable && (
              <ButtonLink href={`/fleet/${encodeURIComponent(a.registration)}/edit`}>
                <Pencil size={14} /> Edit
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="panel grid grid-cols-2 gap-6 rounded-2xl p-6 md:grid-cols-5">
        <Stat label="Airframe hours" value={fmtHours(a.total_hours)} sub="FH" />
        <Stat label="Airframe cycles" value={fmtInt(a.total_cycles)} />
        <Stat label="Engines fitted" value={`${active.size} / ${a.engine_positions}`} />
        <Stat label="Base" value={a.base ?? "—"} />
        <Stat label="Serial no." value={a.serial_number ?? "—"} />
      </div>

      {/* Engine positions */}
      <section>
        <p className="label mb-3">Engine configuration</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: a.engine_positions }, (_, i) => i + 1).map((pos) => {
            const inst = active.get(pos);
            const e = inst?.engines;
            const tone = ehiTone(e?.ehi ?? null);
            const remaining = e?.overhaul_interval_hours && e.tso != null ? e.overhaul_interval_hours - e.tso : null;
            return (
              <div key={pos} className="panel flex flex-col rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tracking-widest text-gold">POSITION {pos}</span>
                  {e && (
                    <span className="font-mono text-sm" style={{ color: tone.color }}>
                      EHI {e.ehi ?? "—"}
                    </span>
                  )}
                </div>
                {inst && e ? (
                  <>
                    <Link href={`/engines/${encodeURIComponent(e.serial_number)}`} className="mt-3 font-mono text-lg hover:text-gold-soft">
                      {e.serial_number}
                    </Link>
                    <p className="text-xs text-muted">{e.model}</p>
                    <dl className="mt-4 space-y-1 font-mono text-xs">
                      <Row k="Installed" v={inst.installed_at} />
                      <Row k="TSO" v={`${fmtHours(e.tso)} FH`} />
                      <Row k="To overhaul" v={remaining == null ? "—" : `${fmtHours(remaining)} FH`} warn={remaining != null && remaining <= 200} />
                    </dl>
                    {editable && (
                      <details className="mt-4 border-t border-border pt-3">
                        <summary className="cursor-pointer text-xs text-danger/80 hover:text-danger">Remove engine…</summary>
                        <div className="mt-3">
                          <RemoveForm installationId={inst.id} today={today} />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-mono text-lg text-muted">EMPTY</p>
                    {editable && (
                      <details className="mt-4 border-t border-border pt-3">
                        <summary className="cursor-pointer text-xs text-accent hover:underline">Install engine…</summary>
                        <div className="mt-3">
                          <InstallForm aircraftId={a.id} position={pos} spares={spares.data ?? []} today={today} />
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel overflow-hidden rounded-2xl lg:col-span-2">
          <p className="label px-6 pt-6">Recent flights</p>
          <div className="mt-3">
            <Table
              head={["Date", "Sortie", "Hours", "Cycles"]}
              empty="No flights logged yet."
              rows={(flights.data ?? []).map((f) => [
                <span key="d" className="font-mono text-muted">{f.flight_date}</span>,
                f.sortie_ref ?? "—",
                <span key="h" className="font-mono">{fmtHours(f.flight_hours)}</span>,
                <span key="c" className="font-mono">{f.cycles}</span>,
              ])}
            />
          </div>
        </section>
        {editable && (
          <section className="panel rounded-2xl p-6">
            <p className="label mb-4">Log flying hours</p>
            <FlightLogForm aircraftId={a.id} today={today} />
            <p className="mt-4 text-xs text-muted">Hours and cycles roll up to the airframe and every engine fitted on that date.</p>
          </section>
        )}
      </div>

      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <p className="label">Open defects</p>
          {editable && (
            <Link href={`/defects/new?aircraft=${encodeURIComponent(a.registration)}`} className="font-mono text-[11px] tracking-widest text-accent hover:underline">
              + RAISE DEFECT
            </Link>
          )}
        </div>
        <div className="mt-3">
          <Table
            head={["Reported", "Description", "Severity", "Status"]}
            empty="No open defects on this aircraft."
            rows={(defects.data ?? []).map((d) => [
              <span key="r" className="font-mono text-muted">{d.reported_at}</span>,
              <Link key="d" href={`/defects/${d.id}`} className="hover:text-gold-soft">{d.description}</Link>,
              <StatusBadge key="s" map={defectSeverity} value={d.severity} />,
              <StatusBadge key="t" map={defectStatus} value={d.status} />,
            ])}
          />
        </div>
      </section>

      <section className="panel overflow-hidden rounded-2xl">
        <p className="label px-6 pt-6">Engine removal history</p>
        <div className="mt-3">
          <Table
            head={["Pos", "Engine", "Installed", "Removed", "Reason"]}
            empty="No engine removals recorded."
            rows={history.map((i) => [
              <span key="p" className="font-mono">#{i.position}</span>,
              i.engines ? (
                <Link key="e" href={`/engines/${encodeURIComponent(i.engines.serial_number)}`} className="font-mono hover:text-gold-soft">
                  {i.engines.serial_number}
                </Link>
              ) : "—",
              <span key="i" className="font-mono text-muted">{i.installed_at}</span>,
              <span key="r" className="font-mono text-muted">{i.removed_at}</span>,
              i.removal_reason ?? "—",
            ])}
          />
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={warn ? "text-warning" : ""}>{v}</dd>
    </div>
  );
}
