import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDot, Cog, Pencil, Plane, ShieldAlert, Wrench } from "lucide-react";
import { EhiGauge, ehiTone } from "@/components/charts";
import { ButtonLink, Stat, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { defectSeverity, defectStatus, engineStatus, fmtHours, fmtInt } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "configuration", label: "Configuration" },
  { key: "defects", label: "Defects" },
  { key: "timeline", label: "Timeline" },
] as const;

type Installation = {
  id: string;
  position: number;
  installed_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  aircraft: { registration: string; aircraft_type: string } | null;
};

type Defect = {
  id: string;
  reported_at: string;
  ata_chapter: string | null;
  system: string | null;
  description: string;
  severity: string;
  status: string;
  action_taken: string | null;
  closed_at: string | null;
};

export default async function EnginePassportPage({ params, searchParams }: PageProps<"/engines/[serial]">) {
  const serial = decodeURIComponent((await params).serial);
  const { tab: tabParam } = (await searchParams) as { tab?: string };
  const tab = tabs.some((t) => t.key === tabParam) ? tabParam! : "overview";

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data: e } = await supabase.from("engines").select("*").eq("serial_number", serial).maybeSingle();
  if (!e) notFound();

  const [installsRes, defectsRes] = await Promise.all([
    supabase
      .from("engine_installations")
      .select("id, position, installed_at, removed_at, removal_reason, aircraft(registration, aircraft_type)")
      .eq("engine_id", e.id)
      .order("installed_at", { ascending: false })
      .returns<Installation[]>(),
    supabase
      .from("defects")
      .select("id, reported_at, ata_chapter, system, description, severity, status, action_taken, closed_at")
      .eq("engine_id", e.id)
      .order("reported_at", { ascending: false })
      .returns<Defect[]>(),
  ]);
  const installs = installsRes.data ?? [];
  const defects = defectsRes.data ?? [];

  const current = installs.find((i) => !i.removed_at);
  const tone = ehiTone(e.ehi);
  const remaining = e.overhaul_interval_hours && e.tso != null ? e.overhaul_interval_hours - e.tso : null;
  const usedPct = e.overhaul_interval_hours && e.tso != null ? Math.min(100, (e.tso / e.overhaul_interval_hours) * 100) : null;
  const openDefects = defects.filter((d) => d.status !== "closed");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/engines" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All engines
      </Link>

      {/* Identity header */}
      <section className="panel overflow-hidden rounded-2xl">
        <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:p-8">
          <div className="grid h-24 w-24 place-items-center rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/15 to-transparent">
            <Cog size={44} className="text-gold" strokeWidth={1.25} />
          </div>
          <div>
            <p className="label !text-gold">Engine Digital Passport</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 font-mono text-3xl font-semibold tracking-wider">
              {e.serial_number}
              <StatusBadge map={engineStatus} value={e.status} />
              {e.ehi != null && e.ehi < 60 && <span className="rounded-md bg-danger/15 px-2 py-0.5 text-xs text-danger">AT RISK</span>}
            </h1>
            <p className="mt-1 text-muted">
              {e.model}
              {e.manufacturer && ` · ${e.manufacturer}`}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Plane size={14} className="text-accent" />
              {current?.aircraft ? (
                <Link href={`/fleet/${encodeURIComponent(current.aircraft.registration)}`} className="hover:text-gold-soft">
                  Installed on <span className="font-mono">{current.aircraft.registration}</span> · position {current.position} · since {current.installed_at}
                </Link>
              ) : (
                <span className="text-muted">Not installed</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-40 text-center">
              <EhiGauge value={e.ehi} />
              <p className="label mt-1">Engine Health Index</p>
            </div>
            {canEdit(user.role) && (
              <ButtonLink href={`/engines/${encodeURIComponent(e.serial_number)}/edit`}>
                <Pencil size={14} /> Edit
              </ButtonLink>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? "?" : `?tab=${t.key}`}
              className={`relative whitespace-nowrap px-4 py-3 text-sm transition ${
                tab === t.key ? "text-gold-soft" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "defects" && openDefects.length > 0 && (
                <span className="ml-1.5 rounded-full bg-danger/20 px-1.5 font-mono text-[10px] text-danger">{openDefects.length}</span>
              )}
              {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gold" />}
            </Link>
          ))}
        </nav>
      </section>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <p className="label">Life data</p>
            <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">
              <Stat label="TSN" value={fmtHours(e.tsn)} sub="Time since new (FH)" />
              <Stat label="CSN" value={fmtInt(e.csn)} sub="Cycles since new" />
              <Stat label="TSO" value={fmtHours(e.tso)} sub="Time since overhaul (FH)" />
              <Stat label="CSO" value={fmtInt(e.cso)} sub="Cycles since overhaul" />
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between">
                <p className="label">Overhaul life consumed</p>
                <p className="font-mono text-sm">
                  {remaining == null ? (
                    <span className="text-muted">Interval not set</span>
                  ) : (
                    <span className={remaining <= 200 ? "text-warning" : ""}>
                      {fmtHours(remaining)} FH remaining of {fmtHours(e.overhaul_interval_hours)}
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${usedPct ?? 0}%`,
                    background: usedPct != null && usedPct >= 95 ? "var(--warning)" : "linear-gradient(90deg, var(--accent), var(--gold))",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">Last overhaul: {e.last_overhaul_date ?? "—"}</p>
            </div>
          </section>

          <section className="panel rounded-2xl p-6">
            <p className="label">Health snapshot</p>
            <p className="mt-4 font-mono text-5xl" style={{ color: tone.color }}>{e.ehi ?? "—"}</p>
            <p className="text-sm" style={{ color: tone.color }}>{tone.label}</p>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Open defects</span><span className="font-mono">{openDefects.length}</span></div>
              <div className="flex justify-between"><span className="text-muted">Installations</span><span className="font-mono">{installs.length}</span></div>
            </div>
            <p className="mt-6 rounded-lg border border-dashed border-border p-3 text-xs text-muted">
              Component health (vibration, oil, hot section, compressor) arrives with Health Monitoring in step 4.
            </p>
          </section>

          {e.notes && (
            <section className="panel rounded-2xl p-6 lg:col-span-3">
              <p className="label">Notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{e.notes}</p>
            </section>
          )}
        </div>
      )}

      {tab === "configuration" && (
        <section className="panel overflow-hidden rounded-2xl">
          <p className="label px-6 pt-6">Installation history</p>
          <div className="mt-3">
            <Table
              head={["Aircraft", "Type", "Position", "Installed", "Removed", "Removal reason"]}
              empty="This engine has never been installed."
              rows={installs.map((i) => [
                i.aircraft ? (
                  <Link key="a" href={`/fleet/${encodeURIComponent(i.aircraft.registration)}`} className="font-mono hover:text-gold-soft">
                    {i.aircraft.registration}
                  </Link>
                ) : "—",
                <span key="t" className="text-muted">{i.aircraft?.aircraft_type ?? "—"}</span>,
                <span key="p" className="font-mono">#{i.position}</span>,
                <span key="i" className="font-mono text-muted">{i.installed_at}</span>,
                i.removed_at ? <span key="r" className="font-mono text-muted">{i.removed_at}</span> : <span key="r" className="text-success">Current</span>,
                i.removal_reason ?? "—",
              ])}
            />
          </div>
        </section>
      )}

      {tab === "defects" && (
        <section className="panel overflow-hidden rounded-2xl">
          <p className="label px-6 pt-6">Defect history</p>
          <div className="mt-3">
            <Table
              head={["Reported", "ATA", "System", "Description", "Severity", "Status"]}
              empty="No defects recorded against this engine."
              rows={defects.map((d) => [
                <span key="r" className="font-mono text-muted">{d.reported_at}</span>,
                <span key="a" className="font-mono">{d.ata_chapter ?? "—"}</span>,
                d.system ?? "—",
                d.description,
                <StatusBadge key="s" map={defectSeverity} value={d.severity} />,
                <StatusBadge key="t" map={defectStatus} value={d.status} />,
              ])}
            />
          </div>
        </section>
      )}

      {tab === "timeline" && <Timeline engine={e} installs={installs} defects={defects} />}
    </div>
  );
}

type Event = { date: string; icon: React.ReactNode; color: string; title: string; detail?: string };

function Timeline({
  engine,
  installs,
  defects,
}: {
  engine: { last_overhaul_date: string | null };
  installs: Installation[];
  defects: Defect[];
}) {
  const events: Event[] = [
    ...installs.flatMap((i) => {
      const reg = i.aircraft?.registration ?? "unknown aircraft";
      const out: Event[] = [
        { date: i.installed_at, icon: <Plane size={14} />, color: "var(--success)", title: `Installed on ${reg} #${i.position}` },
      ];
      if (i.removed_at)
        out.push({ date: i.removed_at, icon: <Wrench size={14} />, color: "var(--warning)", title: `Removed from ${reg} #${i.position}`, detail: i.removal_reason ?? undefined });
      return out;
    }),
    ...defects.map((d) => ({
      date: d.reported_at,
      icon: <ShieldAlert size={14} />,
      color: defectSeverity[d.severity]?.color ?? "var(--muted)",
      title: `Defect: ${d.description}`,
      detail: [d.system, defectStatus[d.status]?.label].filter(Boolean).join(" · "),
    })),
    ...(engine.last_overhaul_date
      ? [{ date: engine.last_overhaul_date, icon: <CircleDot size={14} />, color: "var(--gold)", title: "Overhaul completed" }]
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="panel rounded-2xl p-6 md:p-8">
      <p className="label">Engine timeline</p>
      {events.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No events recorded yet.</p>
      ) : (
        <ol className="relative mt-6 space-y-6 border-l border-border pl-8">
          {events.map((ev, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-[46px] grid h-7 w-7 place-items-center rounded-full border bg-surface"
                style={{ color: ev.color, borderColor: `color-mix(in srgb, ${ev.color} 50%, transparent)` }}
              >
                {ev.icon}
              </span>
              <p className="font-mono text-xs text-muted">{ev.date}</p>
              <p className="mt-0.5 text-sm">{ev.title}</p>
              {ev.detail && <p className="text-xs text-muted">{ev.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
