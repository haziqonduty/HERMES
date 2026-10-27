"use client";

import { useState } from "react";

export type TrendPoint = { label: string; value: number | null; detail?: string };

/**
 * Single-series line chart on a 0–100 scale with an optional threshold line,
 * crosshair and tooltip. One series, so the panel title names it — no legend.
 */
export function TrendChart({
  points,
  threshold,
  thresholdLabel,
  height = 220,
  unit = "",
}: {
  points: TrendPoint[];
  threshold?: number;
  thresholdLabel?: string;
  height?: number;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { t: 12, r: 16, b: 28, l: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / 100) * ih;

  // Break the line where a month has no data instead of drawing through it.
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current) segments.push(current);
      current = "";
    } else {
      current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    }
  });
  if (current) segments.push(current);

  const h = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Trend chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / iw) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)" className="font-mono">
              {t}
            </text>
          </g>
        ))}

        {threshold != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--warning)" strokeOpacity="0.6" strokeDasharray="4 4" />
            {thresholdLabel && (
              <text x={W - pad.r} y={y(threshold) - 5} textAnchor="end" fontSize="10" fill="var(--muted)">
                {thresholdLabel}
              </text>
            )}
          </g>
        )}

        {points.map((p, i) =>
          points.length <= 12 || i % Math.ceil(points.length / 12) === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {p.label}
            </text>
          ) : null,
        )}

        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {h && hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeOpacity="0.5" />
        )}

        {points.map((p, i) =>
          p.value == null ? null : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 5 : 3}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ),
        )}
      </svg>

      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="text-muted">{h.label}</p>
          <p className="font-mono text-sm text-foreground">
            {h.value == null ? "No data" : `${h.value}${unit}`}
          </p>
          {h.detail && <p className="text-muted">{h.detail}</p>}
        </div>
      )}
    </div>
  );
}
