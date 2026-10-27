"use client";

import { useState } from "react";
import type { TrendPoint } from "./trend-chart";

/** Rounds up to a tidy even axis maximum so the midpoint tick is a whole number for counts. */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const step = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 4, 6, 8, 10].map((m) => m * step).find((m) => m >= v)!;
}

/**
 * Single-series vertical bar chart (counts per period) with per-bar hover tooltip.
 * One series, so the panel title names it — no legend.
 */
export function BarChart({ points, height = 240, unit = "" }: { points: TrendPoint[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 420;
  const H = height;
  const pad = { t: 12, r: 6, b: 28, l: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(...points.map((p) => p.value ?? 0)));
  const slot = iw / Math.max(points.length, 1);
  const bw = Math.max(4, Math.min(36, slot - 2 - slot * 0.3));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const h = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(f * max)} y2={y(f * max)} stroke="var(--border)" />
            <text x={pad.l - 8} y={y(f * max) + 3.5} textAnchor="end" fontSize="11" fill="var(--muted)" className="font-mono">
              {Number((f * max).toFixed(1))}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = pad.l + slot * (i + 0.5);
          const v = p.value ?? 0;
          const top = y(v);
          const r = Math.min(4, bw / 2, (pad.t + ih - top) / 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {/* Hit target spans the whole slot, larger than the bar. */}
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
              {v > 0 && (
                <path
                  d={`M${cx - bw / 2},${pad.t + ih} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${pad.t + ih} Z`}
                  fill="var(--accent)"
                  fillOpacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {(points.length <= 6 || i % Math.ceil(points.length / 6) === 0) && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-xl"
          style={{ left: `${((pad.l + slot * (hover + 0.5)) / W) * 100}%` }}
        >
          <p className="text-muted">{h.label}</p>
          <p className="font-mono text-sm text-foreground">{h.value ?? 0}{unit}</p>
          {h.detail && <p className="text-muted">{h.detail}</p>}
        </div>
      )}
    </div>
  );
}
