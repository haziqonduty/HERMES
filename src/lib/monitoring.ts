import type { StatusMeta } from "./status";

/** Condition-monitoring result levels. Colours always ship with the label. */
export type Level = "normal" | "caution" | "alert";

export const monitorLevel: Record<Level, StatusMeta> = {
  normal: { label: "Normal", color: "var(--success)" },
  caution: { label: "Caution", color: "var(--warning)" },
  alert: { label: "Alert", color: "var(--danger)" },
};

const levelRank: Record<Level, number> = { normal: 0, caution: 1, alert: 2 };
export const worstLevel = (levels: (Level | undefined)[]): Level | undefined =>
  levels.reduce<Level | undefined>((w, l) => (l && (!w || levelRank[l] > levelRank[w]) ? l : w), undefined);

/**
 * Fallback oil consumption limit (US qt / FH) when an engine has none set.
 * Placeholder — engineering should set the limit per engine from the maintenance manual.
 */
export const DEFAULT_OIL_LIMIT_QPH = 0.5;
/** Consumption above this share of the limit is a caution. */
export const OIL_CAUTION_RATIO = 0.8;

export function oilLevel(rate: number, limit: number | null | undefined): Level {
  const l = limit ?? DEFAULT_OIL_LIMIT_QPH;
  if (rate > l) return "alert";
  if (rate > l * OIL_CAUTION_RATIO) return "caution";
  return "normal";
}

export const chipFindings: Record<string, StatusMeta & { level: Level }> = {
  clean: { label: "Clean", color: "var(--success)", level: "normal" },
  fuzz: { label: "Fuzz (normal wear)", color: "var(--success)", level: "normal" },
  fine_particles: { label: "Fine particles", color: "var(--warning)", level: "caution" },
  flakes: { label: "Flakes / slivers", color: "var(--danger)", level: "alert" },
  chunks: { label: "Chunks", color: "var(--danger)", level: "alert" },
};

export const borescopeDispositions: Record<string, StatusMeta & { level: Level }> = {
  serviceable: { label: "Serviceable", color: "var(--success)", level: "normal" },
  monitor: { label: "Monitor", color: "var(--warning)", level: "caution" },
  reduced_interval: { label: "Reduced interval", color: "var(--warning)", level: "caution" },
  reject: { label: "Reject — remove", color: "var(--danger)", level: "alert" },
};

export const chipLocations = ["Reduction gearbox", "Power section", "Accessory gearbox", "Scavenge pump", "Other"];
export const borescopeAreas = ["Compressor", "Combustor", "Turbine 1st stage", "Turbine 2nd stage", "Turbine 3rd/4th stage", "Other"];

/** SOAP wear metals (ppm). */
export const soapElements = [
  { key: "fe", label: "Fe", name: "Iron" },
  { key: "cu", label: "Cu", name: "Copper" },
  { key: "ag", label: "Ag", name: "Silver" },
  { key: "mg", label: "Mg", name: "Magnesium" },
  { key: "cr", label: "Cr", name: "Chromium" },
  { key: "ni", label: "Ni", name: "Nickel" },
  { key: "ti", label: "Ti", name: "Titanium" },
  { key: "al", label: "Al", name: "Aluminium" },
] as const;
export type SoapKey = (typeof soapElements)[number]["key"];

export type OilUplift = {
  id: string;
  engine_id: string;
  serviced_at: string;
  quantity_qt: number;
  flight_hours: number;
  rate_qph: number;
  notes: string | null;
};
export type OilSample = Record<SoapKey, number | null> & {
  id: string;
  engine_id: string;
  sampled_at: string;
  lab_ref: string | null;
  level: Level;
  recommendation: string | null;
};
export type ChipCheck = {
  id: string;
  engine_id: string;
  checked_at: string;
  location: string;
  finding: string;
  level: Level;
  action_taken: string | null;
};
export type BorescopeInspection = {
  id: string;
  engine_id: string;
  inspected_at: string;
  area: string;
  findings: string;
  disposition: string;
  level: Level;
  next_due: string | null;
  reference: string | null;
};

export const channels = [
  { key: "oil", label: "Oil consumption" },
  { key: "soap", label: "Oil analysis" },
  { key: "chip", label: "Chip detector" },
  { key: "borescope", label: "Borescope" },
] as const;
export type ChannelKey = (typeof channels)[number]["key"];

/** First row per engine — rows must already be sorted newest first. */
export function latestByEngine<T extends { engine_id: string }>(rows: T[]) {
  const m = new Map<string, T>();
  for (const r of rows) if (!m.has(r.engine_id)) m.set(r.engine_id, r);
  return m;
}
