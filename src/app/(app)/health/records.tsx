import Link from "next/link";
import { StatusBadge, Table } from "@/components/ui";
import {
  borescopeDispositions,
  chipFindings,
  monitorLevel,
  oilLevel,
  soapElements,
  type BorescopeInspection,
  type ChipCheck,
  type OilSample,
  type OilUplift,
} from "@/lib/monitoring";

/** Engine id → serial number. When given, tables show an Engine column (fleet-wide view). */
type Serials = Map<string, string> | undefined;

function EngineCell({ id, serials, tab }: { id: string; serials: Map<string, string>; tab: string }) {
  const sn = serials.get(id) ?? "—";
  return (
    <Link href={`/engines/${encodeURIComponent(sn)}?tab=${tab}`} className="font-mono hover:text-gold-soft">
      {sn}
    </Link>
  );
}

const date = (d: string) => <span className="whitespace-nowrap font-mono text-muted">{d}</span>;
const text = (t: string | null) => <span className="block min-w-48 text-muted">{t ?? "—"}</span>;

export function OilTable({ rows, serials, limits }: { rows: OilUplift[]; serials?: Serials; limits: Map<string, number | null> }) {
  return (
    <Table
      head={[...(serials ? ["Engine"] : []), "Serviced", "Oil added (qt)", "FH since last", "Rate (qt/FH)", "Result", "Notes"]}
      empty="No oil uplifts recorded."
      rows={rows.map((r) => [
        ...(serials ? [<EngineCell key="e" id={r.engine_id} serials={serials} tab="monitoring" />] : []),
        date(r.serviced_at),
        <span key="q" className="font-mono">{Number(r.quantity_qt).toFixed(1)}</span>,
        <span key="h" className="font-mono text-muted">{Number(r.flight_hours).toFixed(1)}</span>,
        <span key="r" className="font-mono">{Number(r.rate_qph).toFixed(2)}</span>,
        <StatusBadge key="l" map={monitorLevel} value={oilLevel(Number(r.rate_qph), limits.get(r.engine_id))} />,
        text(r.notes),
      ])}
    />
  );
}

export function SoapTable({ rows, serials }: { rows: OilSample[]; serials?: Serials }) {
  return (
    <Table
      head={[...(serials ? ["Engine"] : []), "Sampled", "Lab ref", ...soapElements.map((m) => m.label), "Result", "Recommendation"]}
      empty="No oil samples recorded."
      rows={rows.map((r) => [
        ...(serials ? [<EngineCell key="e" id={r.engine_id} serials={serials} tab="monitoring" />] : []),
        date(r.sampled_at),
        <span key="ref" className="whitespace-nowrap font-mono text-xs text-muted">{r.lab_ref ?? "—"}</span>,
        ...soapElements.map((m) => (
          <span key={m.key} className="font-mono">{r[m.key] == null ? "—" : Number(r[m.key]).toFixed(1)}</span>
        )),
        <StatusBadge key="l" map={monitorLevel} value={r.level} />,
        text(r.recommendation),
      ])}
    />
  );
}

export function ChipTable({ rows, serials }: { rows: ChipCheck[]; serials?: Serials }) {
  return (
    <Table
      head={[...(serials ? ["Engine"] : []), "Checked", "Detector", "Finding", "Result", "Action taken"]}
      empty="No chip detector checks recorded."
      rows={rows.map((r) => [
        ...(serials ? [<EngineCell key="e" id={r.engine_id} serials={serials} tab="monitoring" />] : []),
        date(r.checked_at),
        <span key="loc" className="whitespace-nowrap">{r.location}</span>,
        <span key="f" className="whitespace-nowrap">{chipFindings[r.finding]?.label ?? r.finding}</span>,
        <StatusBadge key="l" map={monitorLevel} value={r.level} />,
        text(r.action_taken),
      ])}
    />
  );
}

export function BorescopeTable({ rows, serials }: { rows: BorescopeInspection[]; serials?: Serials }) {
  return (
    <Table
      head={[...(serials ? ["Engine"] : []), "Inspected", "Area", "Findings", "Disposition", "Next due", "Ref"]}
      empty="No borescope inspections recorded."
      rows={rows.map((r) => [
        ...(serials ? [<EngineCell key="e" id={r.engine_id} serials={serials} tab="monitoring" />] : []),
        date(r.inspected_at),
        <span key="a" className="whitespace-nowrap">{r.area}</span>,
        <span key="f" className="block min-w-56">{r.findings}</span>,
        <StatusBadge key="d" map={borescopeDispositions} value={r.disposition} />,
        r.next_due ? date(r.next_due) : <span key="n" className="text-muted">—</span>,
        <span key="ref" className="whitespace-nowrap font-mono text-xs text-muted">{r.reference ?? "—"}</span>,
      ])}
    />
  );
}
