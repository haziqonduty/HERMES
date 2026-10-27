import Link from "next/link";
import type { StatusMeta } from "@/lib/status";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label !text-gold">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs capitalize"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, StatusMeta>; value: string }) {
  const meta = map[value] ?? { label: value, color: "var(--muted)" };
  return <Badge color={meta.color}>{meta.label}</Badge>;
}

export function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="label">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-6 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-border">
              <td colSpan={head.length} className="px-6 py-8 text-center text-muted">{empty}</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-border transition hover:bg-surface-2/60">
                {r.map((c, j) => (
                  <td key={j} className="px-6 py-3">{c}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const buttonStyles = {
  primary:
    "bg-gradient-to-b from-gold-soft to-gold text-background font-semibold shadow-[0_0_30px_-12px_var(--gold)] hover:brightness-110",
  secondary: "border border-border text-foreground hover:border-gold/50 hover:text-gold-soft",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

export function buttonClass(variant: keyof typeof buttonStyles = "secondary") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition disabled:opacity-50 ${buttonStyles[variant]}`;
}

export function ButtonLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1.5 font-mono text-xl tabular-nums" style={tone ? { color: tone } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Chip({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
        active ? "border-gold/50 bg-gold/10 text-gold-soft" : "border-border text-muted hover:text-foreground"
      }`}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </Link>
  );
}
