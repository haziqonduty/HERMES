/** Semicircle gauge for Engine Health Index (0–100). */
export function EhiGauge({ value }: { value: number | null }) {
  const v = value ?? 0;
  const tone = ehiTone(value);
  const r = 52;
  const half = Math.PI * r;

  return (
    <svg viewBox="0 0 128 76" className="w-full max-w-[180px]">
      <path d="M12 68 A52 52 0 0 1 116 68" fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M12 68 A52 52 0 0 1 116 68"
        fill="none"
        stroke={tone.color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * half} ${half}`}
        style={{ filter: `drop-shadow(0 0 6px ${tone.color})` }}
      />
      <text x="64" y="58" textAnchor="middle" className="fill-foreground font-mono" fontSize="26">
        {value ?? "—"}
      </text>
      <text x="64" y="72" textAnchor="middle" fill={tone.color} fontSize="9" letterSpacing="1.5">
        {tone.label.toUpperCase()}
      </text>
    </svg>
  );
}

export function ehiTone(value: number | null) {
  if (value == null) return { label: "No data", color: "var(--muted)" };
  if (value >= 75) return { label: "Good", color: "var(--success)" };
  if (value >= 60) return { label: "Watch", color: "var(--accent)" };
  if (value >= 45) return { label: "Warning", color: "var(--warning)" };
  return { label: "Critical", color: "var(--danger)" };
}

/** Donut chart from labelled segments. */
export function Donut({ segments, centre, sub }: { segments: { value: number; color: string }[]; centre: string; sub: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      <g className="rotate-90" style={{ transformOrigin: "50px 50px" }}>
        <text x="50" y="50" textAnchor="middle" className="fill-foreground font-mono" fontSize="16">
          {centre}
        </text>
        <text x="50" y="62" textAnchor="middle" fill="var(--muted)" fontSize="6.5" letterSpacing="1">
          {sub}
        </text>
      </g>
    </svg>
  );
}
