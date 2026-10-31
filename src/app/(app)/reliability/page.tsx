import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { ehiTone } from "@/components/charts";
import { Chip, PageHeader, StatusBadge, Table } from "@/components/ui";
import { ataChapters, daysBetween, removalType } from "@/lib/defects";
import { fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";
import { SetupNotice } from "@/components/setup-notice";

export const metadata = { title: "Reliability Analytics" };

const periods = [6, 12, 24] as const;
const paretos = {
  defects: { title: "Defect failure modes", chip: "Defects" },
  removals: { title: "Unscheduled removal causes", chip: "Removals" },
  ata: { title: "Defects by ATA chapter", chip: "ATA" },
} as const;

type HoursRow = { month: string; flights: number; aircraft_hours: number; engine_hours: number };
type Removal = {
  id: string;
  engine_id: string;
  position: number;
  installed_at: string;
  removed_at: string;
  removal_reason: string | null;
  removal_type: string | null;
  failure_mode: string | null;
  confirmed_failure: boolean | null;
  engines: { serial_number: string } | null;
  aircraft: { registration: string } | null;
};
type Defect = {
  id: string;
  reported_at: string;
  closed_at: string | null;
  ata_chapter: string | null;
  failure_mode: string | null;
  engine_id: string | null;
};

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function ReliabilityPage({ searchParams }: PageProps<"/reliability">) {
  const sp = (await searchParams) as { period?: string; pareto?: string };
  const period = periods.find((p) => String(p) === sp.period) ?? 12;
  const pareto = (sp.pareto && sp.pareto in paretos ? sp.pareto : "defects") as keyof typeof paretos;

  const now = await requestNow();
  const months = Array.from({ length: period }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (period - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: monthFmt.format(d) };
  });
  const since = `${months[0].key}-01`;

  const supabase = await createClient();
  const [hoursRes, removalsRes, defectsRes, enginesRes] = await Promise.all([
    supabase.from("engine_hours_monthly").select("*").gte("month", since).returns<HoursRow[]>(),
    supabase
      .from("engine_installations")
      .select("id, engine_id, position, installed_at, removed_at, removal_reason, removal_type, failure_mode, confirmed_failure, engines(serial_number), aircraft(registration)")
      .gte("removed_at", since)
      .order("removed_at", { ascending: false })
      .returns<Removal[]>(),
    supabase
      .from("defects")
      .select("id, reported_at, closed_at, ata_chapter, failure_mode, engine_id")
      .gte("reported_at", since)
      .returns<Defect[]>(),
    supabase.from("engines").select("id, serial_number, ehi, status"),
  ]);
  if (hoursRes.error || removalsRes.error || defectsRes.error) return <SetupNotice module="Reliability Analytics" />;

  const hours = hoursRes.data ?? [];
  const removals = removalsRes.data ?? [];
  const defects = defectsRes.data ?? [];
  const engines = enginesRes.data ?? [];

  const efh = hours.reduce((s, h) => s + Number(h.engine_hours ?? 0), 0);
  const afh = hours.reduce((s, h) => s + Number(h.aircraft_hours ?? 0), 0);
  const unscheduled = removals.filter((r) => r.removal_type === "unscheduled");
  const confirmed = unscheduled.filter((r) => r.confirmed_failure);
  const scheduled = removals.filter((r) => r.removal_type === "scheduled");
  const closed = defects.filter((d) => d.closed_at);
  const mttr = closed.length ? closed.reduce((s, d) => s + daysBetween(d.reported_at, d.closed_at!), 0) / closed.length : null;

  const mtbur = unscheduled.length && efh ? efh / unscheduled.length : null;
  const mtbf = confirmed.length && efh ? efh / confirmed.length : null;
  const urr = efh ? (unscheduled.length * 1000) / efh : null;
  const defectRate = afh ? (defects.length * 1000) / afh : null;

  const perMonth = <T,>(rows: T[], date: (r: T) => string, detail?: (n: number, key: string) => string | undefined) =>
    months.map((m) => {
      const n = rows.filter((r) => date(r).startsWith(m.key)).length;
      return { label: m.label, value: n, detail: detail?.(n, m.key) };
    });
  const hoursByMonth = new Map(hours.map((h) => [h.month.slice(0, 7), Number(h.engine_hours ?? 0)]));
  const removalPoints = perMonth(unscheduled, (r) => r.removed_at, (_, k) => `${fmtHours(hoursByMonth.get(k) ?? 0)} engine FH`);
  const defectPoints = perMonth(defects, (d) => d.reported_at);

  // Pareto
  const tally = new Map<string, number>();
  const add = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1);
  if (pareto === "defects") defects.forEach((d) => add(d.failure_mode ?? "Not classified"));
  if (pareto === "removals") unscheduled.forEach((r) => add(r.failure_mode ?? "Not classified"));
  if (pareto === "ata")
    defects.forEach((d) => {
      const name = ataChapters.find((a) => a.code === d.ata_chapter)?.name;
      add(d.ata_chapter ? `ATA ${d.ata_chapter}${name ? ` · ${name}` : ""}` : "No ATA");
    });
  const paretoTotal = [...tally.values()].reduce((s, n) => s + n, 0);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const paretoRows = sorted.map(([label, n], i) => {
    const before = sorted.slice(0, i).reduce((s, [, v]) => s + v, 0);
    return { label, n, pct: (n / paretoTotal) * 100, cum: ((before + n) / paretoTotal) * 100, vital: before / paretoTotal < 0.8 };
  });
  const paretoMax = paretoRows[0]?.n ?? 1;

  // Bad actors: engines with the most unscheduled removals and defects in the period.
  const badActors = engines
    .map((e) => {
      const ur = unscheduled.filter((r) => r.engine_id === e.id).length;
      const df = defects.filter((d) => d.engine_id === e.id).length;
      return { ...e, ur, df, score: ur * 3 + df };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || b.ur - a.ur)
    .slice(0, 8);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(period !== 12 && { period: String(period) }), ...(pareto !== "defects" && { pareto }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/reliability?${s}` : "/reliability";
  };
  const hasHours = efh > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Engineering"
        title="Reliability Analytics"
        description="Engine removal and defect rates, failure-mode Pareto and bad actors."
        actions={
          <div className="flex gap-1.5">
            {periods.map((p) => (
              <Chip key={p} href={link({ period: p === 12 ? "" : String(p) })} active={period === p}>
                {p} months
              </Chip>
            ))}
          </div>
        }
      />

      {!hasHours && (
        <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 px-5 py-4 text-sm text-gold-soft">
          No flying hours logged in this period, so MTBUR, MTBF and rates can&apos;t be calculated. Log flights on each aircraft page.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="MTBUR" value={mtbur == null ? "—" : fmtHours(Math.round(mtbur))} unit="EFH" hint="Mean time between unscheduled removals" />
        <Kpi label="MTBF" value={mtbf == null ? "—" : fmtHours(Math.round(mtbf))} unit="EFH" hint="Mean time between confirmed failures" />
        <Kpi label="Unscheduled removal rate" value={urr == null ? "—" : urr.toFixed(2)} hint="Per 1,000 engine flight hours" />
        <Kpi label="Defect rate" value={defectRate == null ? "—" : defectRate.toFixed(1)} hint="Per 1,000 aircraft flight hours" />
        <Kpi label="Mean time to rectify" value={mttr == null ? "—" : mttr.toFixed(1)} unit="days" hint={`${closed.length} defects closed`} />
        <Kpi label="Engine flight hours" value={fmtHours(Math.round(efh))} hint={`${fmtHours(Math.round(afh))} aircraft FH`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-2xl p-6">
          <div className="flex items-end justify-between">
            <p className="label">Unscheduled engine removals per month</p>
            <p className="font-mono text-xs text-muted">{unscheduled.length} total</p>
          </div>
          <div className="mt-4">
            <BarChart points={removalPoints} />
          </div>
        </div>
        <div className="panel rounded-2xl p-6">
          <div className="flex items-end justify-between">
            <p className="label">Defects reported per month</p>
            <p className="font-mono text-xs text-muted">{defects.length} total</p>
          </div>
          <div className="mt-4">
            <BarChart points={defectPoints} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="panel rounded-2xl p-6 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label">Pareto — {paretos[pareto].title.toLowerCase()}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(paretos).map(([k, p]) => (
                <Chip key={k} href={link({ pareto: k === "defects" ? "" : k })} active={pareto === k}>
                  {p.chip}
                </Chip>
              ))}
            </div>
          </div>
          {paretoRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">No records in this period.</p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-[minmax(0,12rem)_1fr_3rem_3.5rem] items-center gap-x-3 gap-y-2.5 text-sm">
                <span className="label">Cause</span>
                <span className="label">Count</span>
                <span className="label text-right">Share</span>
                <span className="label text-right">Cum.</span>
                {paretoRows.map((r) => (
                  <ParetoRow key={r.label} row={r} max={paretoMax} />
                ))}
              </div>
              <p className="mt-5 text-xs text-muted">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-gold align-middle" />
                Vital few: the causes making up the first 80% of {paretoTotal} records — focus improvement effort here.
              </p>
            </>
          )}
        </div>

        <div className="panel overflow-hidden rounded-2xl lg:col-span-2">
          <p className="label px-6 pt-6">Bad actors — engines with repeat events</p>
          <div className="mt-3">
            <Table
              head={["Engine", "Unsched. removals", "Defects", "EHI"]}
              empty="No engine events in this period."
              rows={badActors.map((e) => [
                <Link key="sn" href={`/engines/${encodeURIComponent(e.serial_number)}?tab=timeline`} className="font-mono hover:text-gold-soft">
                  {e.serial_number}
                </Link>,
                <span key="ur" className={`font-mono ${e.ur ? "text-warning" : "text-muted"}`}>{e.ur}</span>,
                <span key="df" className="font-mono">{e.df}</span>,
                <span key="ehi" className="font-mono" style={{ color: ehiTone(e.ehi).color }}>{e.ehi ?? "—"}</span>,
              ])}
            />
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6">
          <p className="label">Engine removals</p>
          <p className="font-mono text-xs text-muted">
            {scheduled.length} scheduled · {unscheduled.length} unscheduled · {confirmed.length} confirmed failures
            {removals.length - scheduled.length - unscheduled.length > 0 && ` · ${removals.length - scheduled.length - unscheduled.length} unclassified`}
          </p>
        </div>
        <div className="mt-3">
          <Table
            head={["Removed", "Engine", "Aircraft", "Type", "Failure mode", "Confirmed", "Time on wing", "Reason"]}
            empty="No engine removals in this period."
            rows={removals.map((r) => [
              <span key="d" className="whitespace-nowrap font-mono text-muted">{r.removed_at}</span>,
              r.engines ? (
                <Link key="e" href={`/engines/${encodeURIComponent(r.engines.serial_number)}?tab=configuration`} className="font-mono hover:text-gold-soft">
                  {r.engines.serial_number}
                </Link>
              ) : "—",
              <span key="a" className="whitespace-nowrap font-mono">
                {r.aircraft?.registration ?? "—"} <span className="text-muted">#{r.position}</span>
              </span>,
              r.removal_type ? <StatusBadge key="t" map={removalType} value={r.removal_type} /> : <span key="t" className="text-muted">Unclassified</span>,
              <span key="f" className="whitespace-nowrap">{r.failure_mode ?? "—"}</span>,
              <span key="c" className={r.confirmed_failure ? "text-danger" : "text-muted"}>
                {r.confirmed_failure == null ? "—" : r.confirmed_failure ? "Yes" : "No fault found"}
              </span>,
              <span key="w" className="whitespace-nowrap font-mono text-muted">{daysBetween(r.installed_at, r.removed_at)} days</span>,
              <span key="r" className="block min-w-56 text-muted">{r.removal_reason ?? "—"}</span>,
            ])}
          />
        </div>
      </section>

      <p className="text-xs text-muted">
        Engine flight hours = each logged flight × the engines fitted to that aircraft on the flight date. MTBUR counts all unscheduled removals;
        MTBF counts only removals where the failure was confirmed at the shop.
      </p>
    </div>
  );
}

function ParetoRow({ row, max }: { row: { label: string; n: number; pct: number; cum: number; vital: boolean }; max: number }) {
  return (
    <>
      <span className="truncate" title={row.label}>{row.label}</span>
      <span className="flex items-center gap-2">
        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span
            className="block h-full rounded-full"
            style={{ width: `${(row.n / max) * 100}%`, background: row.vital ? "var(--gold)" : "var(--muted)", opacity: row.vital ? 1 : 0.5 }}
          />
        </span>
        <span className="w-6 text-right font-mono">{row.n}</span>
      </span>
      <span className="text-right font-mono text-muted">{row.pct.toFixed(0)}%</span>
      <span className="text-right font-mono">{row.cum.toFixed(0)}%</span>
    </>
  );
}

function Kpi({ label, value, hint, unit }: { label: string; value: string; hint: string; unit?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <p className="label">{label}</p>
      <p className="mt-4 font-mono text-3xl font-medium tabular-nums">
        {value}
        {unit && value !== "—" && <span className="ml-1.5 text-sm text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
