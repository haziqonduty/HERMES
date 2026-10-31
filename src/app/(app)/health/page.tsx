import Link from "next/link";
import { AlertOctagon, AlertTriangle, CalendarClock, ClipboardCheck, Database } from "lucide-react";
import { ehiTone } from "@/components/charts";
import { Chip, PageHeader, StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_OIL_LIMIT_QPH,
  borescopeDispositions,
  channels,
  chipFindings,
  monitorLevel,
  type Level,
} from "@/lib/monitoring";
import { describe, loadMonitoring, statusByEngine, type MonitorStatus } from "@/lib/monitoring-data";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";
import { BorescopeForm, ChipCheckForm, OilSampleForm, OilUpliftForm } from "./forms";
import { BorescopeTable, ChipTable, OilTable, SoapTable } from "./records";

export const metadata = { title: "Health Monitoring · Hermes" };

const tabs = [{ key: "overview", label: "Overview" }, ...channels] as const;

type EngineRow = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  ehi: number | null;
  oil_limit_qph: number | null;
  engine_installations: { removed_at: string | null; position: number; aircraft: { registration: string } | null }[];
};

export default async function HealthPage({ searchParams }: PageProps<"/health">) {
  const sp = (await searchParams) as { tab?: string; level?: string };
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "overview";
  const levelFilter = sp.level && sp.level in monitorLevel ? (sp.level as Level) : null;

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const now = await requestNow();
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const in30d = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [enginesRes, data] = await Promise.all([
    supabase
      .from("engines")
      .select("id, serial_number, model, status, ehi, oil_limit_qph, engine_installations(removed_at, position, aircraft(registration))")
      .neq("status", "retired")
      .order("serial_number")
      .returns<EngineRow[]>(),
    loadMonitoring(supabase, { since }),
  ]);
  if (enginesRes.error || !data) return <SetupNotice />;

  const engines = enginesRes.data ?? [];
  const serials = new Map(engines.map((e) => [e.id, e.serial_number]));
  const limits = new Map(engines.map((e) => [e.id, e.oil_limit_qph]));
  const status = statusByEngine(data, limits);
  const editable = canEdit(user.role);
  const engineOptions = engines.map((e) => ({ id: e.id, serial_number: e.serial_number, oil_limit_qph: e.oil_limit_qph }));

  const location = (e: EngineRow) => {
    const i = e.engine_installations.find((x) => !x.removed_at);
    return i?.aircraft ? `${i.aircraft.registration} #${i.position}` : "Store";
  };
  const inLevel = (l: Level) => engines.filter((e) => status.get(e.id)?.overall === l);
  const recentCount = [
    ...data.oil.map((r) => r.serviced_at),
    ...data.soap.map((r) => r.sampled_at),
    ...data.chip.map((r) => r.checked_at),
    ...data.borescope.map((r) => r.inspected_at),
  ].filter((d) => d >= since30d).length;
  const due = engines
    .map((e) => ({ e, b: status.get(e.id)?.borescope }))
    .filter((x): x is { e: EngineRow; b: NonNullable<MonitorStatus["borescope"]> } => !!x.b?.next_due)
    .sort((a, b) => a.b.next_due!.localeCompare(b.b.next_due!));

  const rank = { alert: 0, caution: 1, normal: 2 } as const;
  const matrix = engines
    .filter((e) => !levelFilter || status.get(e.id)?.overall === levelFilter)
    .sort((a, b) => {
      const la = status.get(a.id)?.overall, lb = status.get(b.id)?.overall;
      return (la ? rank[la] : 3) - (lb ? rank[lb] : 3) || (a.ehi ?? 101) - (b.ehi ?? 101);
    });

  const findings = engines
    .flatMap((e) => {
      const s = status.get(e.id);
      if (!s) return [];
      return channels.flatMap((c) => {
        const rec = s[c.key];
        if (!rec || rec.level === "normal") return [];
        return [{ engine: e, channel: c, level: rec.level, text: describe(c.key, s)! }];
      });
    })
    .sort((a, b) => rank[a.level] - rank[b.level]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Engineering"
        title="Health Monitoring"
        description="Oil consumption, oil analysis, chip detector and borescope findings across the fleet."
      />

      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? "/health" : `/health?tab=${t.key}`}
            className={`relative whitespace-nowrap px-4 py-3 text-sm transition ${tab === t.key ? "text-gold-soft" : "text-muted hover:text-foreground"}`}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gold" />}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Engines in alert" value={inLevel("alert").length} hint="Latest result on any channel" color="var(--danger)" icon={<AlertOctagon size={18} />} />
            <Kpi label="Engines in caution" value={inLevel("caution").length} hint="Monitor / resample" color="var(--warning)" icon={<AlertTriangle size={18} />} />
            <Kpi label="Records — 30 days" value={recentCount} hint="All monitoring channels" icon={<ClipboardCheck size={18} />} />
            <Kpi
              label="Borescope due ≤ 30 days"
              value={due.filter((x) => x.b.next_due! <= in30d).length}
              hint={`${due.filter((x) => x.b.next_due! < today).length} overdue`}
              icon={<CalendarClock size={18} />}
            />
          </section>

          <section className="panel overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
              <p className="label">Engine monitoring matrix — latest result per channel</p>
              <div className="flex gap-1.5">
                <Chip href="/health" active={!levelFilter}>All</Chip>
                {(["alert", "caution", "normal"] as const).map((l) => (
                  <Chip key={l} href={`/health?level=${l}`} active={levelFilter === l} color={monitorLevel[l].color}>
                    {monitorLevel[l].label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Table
                head={["Engine", "Location", "EHI", ...channels.map((c) => c.label), "Overall"]}
                empty="No engines match."
                rows={matrix.map((e) => {
                  const s = status.get(e.id);
                  return [
                    <Link key="sn" href={`/engines/${encodeURIComponent(e.serial_number)}?tab=monitoring`} className="font-mono hover:text-gold-soft">
                      {e.serial_number}
                    </Link>,
                    <span key="l" className="whitespace-nowrap font-mono text-muted">{location(e)}</span>,
                    <span key="ehi" className="font-mono" style={{ color: ehiTone(e.ehi).color }}>{e.ehi ?? "—"}</span>,
                    <Cell key="oil" level={s?.oil?.level} value={s?.oil && `${Number(s.oil.rate_qph).toFixed(2)} qt/FH`} date={s?.oil?.serviced_at} />,
                    <Cell key="soap" level={s?.soap?.level} value={s?.soap && `Fe ${s.soap.fe ?? "—"} ppm`} date={s?.soap?.sampled_at} />,
                    <Cell key="chip" level={s?.chip?.level} value={s?.chip && chipFindings[s.chip.finding]?.label} date={s?.chip?.checked_at} />,
                    <Cell key="bsi" level={s?.borescope?.level} value={s?.borescope && borescopeDispositions[s.borescope.disposition]?.label} date={s?.borescope?.inspected_at} />,
                    s?.overall ? <StatusBadge key="o" map={monitorLevel} value={s.overall} /> : <span key="o" className="text-muted">No data</span>,
                  ];
                })}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel overflow-hidden rounded-2xl">
              <p className="label px-6 pt-6">Active findings</p>
              <ul className="mt-3 divide-y divide-border">
                {findings.slice(0, 8).map((f, i) => (
                  <li key={i}>
                    <Link
                      href={`/engines/${encodeURIComponent(f.engine.serial_number)}?tab=monitoring`}
                      className="flex items-start gap-3 px-6 py-3 text-sm transition hover:bg-surface-2/60"
                    >
                      <StatusBadge map={monitorLevel} value={f.level} />
                      <span className="min-w-0">
                        <span className="block truncate">{f.text}</span>
                        <span className="block font-mono text-[11px] text-muted">
                          {f.engine.serial_number} · {location(f.engine)} · {f.channel.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {findings.length === 0 && <li className="px-6 py-4 text-sm text-muted">No caution or alert findings.</li>}
              </ul>
            </div>

            <div className="panel overflow-hidden rounded-2xl">
              <p className="label px-6 pt-6">Borescope inspections due</p>
              <ul className="mt-3 divide-y divide-border">
                {due.slice(0, 8).map(({ e, b }) => {
                  const overdue = b.next_due! < today;
                  const soon = b.next_due! <= in30d;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/engines/${encodeURIComponent(e.serial_number)}?tab=monitoring`}
                        className="flex items-center justify-between gap-3 px-6 py-3 text-sm transition hover:bg-surface-2/60"
                      >
                        <span className="min-w-0">
                          <span className="font-mono">{e.serial_number}</span>
                          <span className="ml-2 text-muted">{b.area}</span>
                        </span>
                        <span className={`whitespace-nowrap font-mono ${overdue ? "text-danger" : soon ? "text-warning" : "text-muted"}`}>
                          {b.next_due}
                          {overdue ? " · overdue" : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {due.length === 0 && <li className="px-6 py-4 text-sm text-muted">No follow-up inspections scheduled.</li>}
              </ul>
            </div>
          </section>
        </>
      )}

      {tab !== "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="panel overflow-hidden rounded-2xl lg:col-span-2">
            <div className="flex items-end justify-between px-6 pt-6">
              <p className="label">Recent records — fleet</p>
              {tab === "oil" && (
                <p className="text-xs text-muted">
                  Caution above 80% of limit · default limit {DEFAULT_OIL_LIMIT_QPH} qt/FH unless set on the engine
                </p>
              )}
            </div>
            <div className="mt-3">
              {tab === "oil" && <OilTable rows={data.oil.slice(0, 50)} serials={serials} limits={limits} />}
              {tab === "soap" && <SoapTable rows={data.soap.slice(0, 50)} serials={serials} />}
              {tab === "chip" && <ChipTable rows={data.chip.slice(0, 50)} serials={serials} />}
              {tab === "borescope" && <BorescopeTable rows={data.borescope.slice(0, 50)} serials={serials} />}
            </div>
          </section>

          {editable && (
            <section className="panel h-fit rounded-2xl p-6">
              <p className="label mb-5">Record {channels.find((c) => c.key === tab)?.label.toLowerCase()}</p>
              {tab === "oil" && <OilUpliftForm engines={engineOptions} today={today} />}
              {tab === "soap" && <OilSampleForm engines={engineOptions} today={today} />}
              {tab === "chip" && <ChipCheckForm engines={engineOptions} today={today} />}
              {tab === "borescope" && <BorescopeForm engines={engineOptions} today={today} />}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ level, value, date }: { level?: Level; value?: string; date?: string }) {
  if (!level) return <span className="text-muted">—</span>;
  const meta = monitorLevel[level];
  return (
    <span className="block whitespace-nowrap">
      <span className="flex items-center gap-1.5 text-xs" style={{ color: meta.color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
        {meta.label}
      </span>
      <span className="block font-mono text-xs">{value}</span>
      <span className="block font-mono text-[10px] text-muted">{date}</span>
    </span>
  );
}

function Kpi({ label, value, hint, icon, color }: { label: string; value: number; hint: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="label">{label}</p>
        <span className="opacity-80" style={{ color: color ?? "var(--gold)" }}>{icon}</span>
      </div>
      <p className="mt-4 font-mono text-4xl font-medium tabular-nums" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="panel mx-auto max-w-2xl rounded-2xl p-8">
      <Database className="text-gold" />
      <h1 className="mt-4 text-xl font-medium">Health Monitoring not set up yet</h1>
      <p className="mt-2 text-sm text-muted">
        Run <code className="text-gold-soft">supabase/migrations/0004_health_monitoring.sql</code> in the Supabase SQL Editor, then refresh this page.
      </p>
    </div>
  );
}
