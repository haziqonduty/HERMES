import "server-only";
import type { createClient } from "./supabase/server";
import {
  latestByEngine,
  oilLevel,
  worstLevel,
  type BorescopeInspection,
  type ChannelKey,
  type ChipCheck,
  type Level,
  type OilSample,
  type OilUplift,
} from "./monitoring";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MonitoringData = {
  oil: OilUplift[];
  soap: OilSample[];
  chip: ChipCheck[];
  borescope: BorescopeInspection[];
};

/** All monitoring records since `since` (newest first), optionally for one engine. Null if 0004 isn't applied. */
export async function loadMonitoring(supabase: Supabase, opts: { since?: string; engineId?: string } = {}): Promise<MonitoringData | null> {
  const q = (table: string, dateCol: string) => {
    let query = supabase.from(table).select("*").order(dateCol, { ascending: false }).order("created_at", { ascending: false });
    if (opts.since) query = query.gte(dateCol, opts.since);
    if (opts.engineId) query = query.eq("engine_id", opts.engineId);
    return query.limit(2000);
  };
  const [oil, soap, chip, borescope] = await Promise.all([
    q("oil_uplifts", "serviced_at").returns<OilUplift[]>(),
    q("oil_samples", "sampled_at").returns<OilSample[]>(),
    q("chip_checks", "checked_at").returns<ChipCheck[]>(),
    q("borescope_inspections", "inspected_at").returns<BorescopeInspection[]>(),
  ]);
  if (oil.error || soap.error || chip.error || borescope.error) return null;
  return { oil: oil.data ?? [], soap: soap.data ?? [], chip: chip.data ?? [], borescope: borescope.data ?? [] };
}

export type MonitorStatus = {
  oil?: OilUplift & { level: Level };
  soap?: OilSample;
  chip?: ChipCheck;
  borescope?: BorescopeInspection;
  overall?: Level;
};

/** Latest record per channel for each engine, with the oil level resolved against the engine's limit. */
export function statusByEngine(data: MonitoringData, limits: Map<string, number | null>) {
  const oil = latestByEngine(data.oil);
  const soap = latestByEngine(data.soap);
  const chip = latestByEngine(data.chip);
  const bsi = latestByEngine(data.borescope);
  const ids = new Set([...oil.keys(), ...soap.keys(), ...chip.keys(), ...bsi.keys()]);

  const out = new Map<string, MonitorStatus>();
  for (const id of ids) {
    const o = oil.get(id);
    const s: MonitorStatus = {
      oil: o && { ...o, level: oilLevel(Number(o.rate_qph), limits.get(id)) },
      soap: soap.get(id),
      chip: chip.get(id),
      borescope: bsi.get(id),
    };
    s.overall = worstLevel([s.oil?.level, s.soap?.level, s.chip?.level, s.borescope?.level]);
    out.set(id, s);
  }
  return out;
}

/** One-line summary of a channel's latest record, for alerts. */
export function describe(channel: ChannelKey, s: MonitorStatus) {
  switch (channel) {
    case "oil":
      return s.oil && `Oil consumption ${Number(s.oil.rate_qph).toFixed(2)} qt/FH`;
    case "soap":
      return s.soap && `Oil analysis ${s.soap.level}${s.soap.recommendation ? ` — ${s.soap.recommendation}` : ""}`;
    case "chip":
      return s.chip && `Chip detector (${s.chip.location}): ${s.chip.finding.replace("_", " ")}`;
    case "borescope":
      return s.borescope && `Borescope ${s.borescope.area}: ${s.borescope.findings}`;
  }
}
