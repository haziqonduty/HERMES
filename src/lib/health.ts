import type { TrendPoint } from "@/components/trend-chart";

/** EHI components and weights — must match the generated column in 0003_engine_health_index.sql. */
export const ehiComponents = [
  { key: "vibration", label: "Vibration", weight: 20 },
  { key: "oil_system", label: "Oil system", weight: 20 },
  { key: "hot_section", label: "Hot section", weight: 20 },
  { key: "compressor", label: "Compressor", weight: 15 },
  { key: "fuel_system", label: "Fuel system", weight: 10 },
  { key: "accessories", label: "Accessories", weight: 15 },
] as const;

export type ComponentKey = (typeof ehiComponents)[number]["key"];
export type Assessment = Record<ComponentKey, number> & {
  id: string;
  engine_id: string;
  assessed_at: string;
  ehi: number;
  source: string | null;
  notes: string | null;
};

export const AT_RISK_EHI = 60;

/** EHI bands, worst first. Colours are status colours and always ship with the label. */
export const ehiBands = [
  { key: "critical", label: "Critical", range: "< 45", min: 0, color: "var(--danger)" },
  { key: "warning", label: "Warning", range: "45–59", min: 45, color: "var(--warning)" },
  { key: "watch", label: "Watch", range: "60–74", min: 60, color: "var(--accent)" },
  { key: "good", label: "Good", range: "≥ 75", min: 75, color: "var(--success)" },
] as const;

export const bandOf = (ehi: number) => [...ehiBands].reverse().find((b) => ehi >= b.min)!;

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

/** Average EHI per calendar month for the last `months` months (oldest first). */
export function monthlyAverage(rows: { assessed_at: string; ehi: number }[], months: number, now: Date): TrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    const k = r.assessed_at.slice(0, 7);
    buckets.set(k, [...(buckets.get(k) ?? []), r.ehi]);
  }
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    const vals = buckets.get(d.toISOString().slice(0, 7)) ?? [];
    return {
      label: monthFmt.format(d),
      value: vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null,
      detail: vals.length ? `${vals.length} assessment${vals.length > 1 ? "s" : ""}` : undefined,
    };
  });
}
