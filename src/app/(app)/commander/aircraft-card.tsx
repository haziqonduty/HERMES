import Link from "next/link";
import { CalendarClock, ClipboardList, ShieldAlert, Wrench } from "lucide-react";
import { ehiTone } from "@/components/charts";
import { StatusBadge } from "@/components/ui";
import { monitorLevel } from "@/lib/monitoring";
import { riskMeta, type AircraftReadiness } from "@/lib/readiness";
import { aircraftStatus } from "@/lib/status";

/** One aircraft on the commander status board: status, risk, engine EHI strip and open work. */
export function AircraftCard({ a }: { a: AircraftReadiness }) {
  const risk = riskMeta[a.risk];
  return (
    <Link
      href={`/fleet/${encodeURIComponent(a.registration)}`}
      className="panel group block rounded-2xl p-5 transition hover:border-gold/40"
      style={{ boxShadow: a.risk === "high" ? "inset 3px 0 0 var(--danger)" : a.risk === "elevated" ? "inset 3px 0 0 var(--warning)" : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-2xl font-semibold tracking-wider group-hover:text-gold-soft">{a.registration}</p>
          <p className="text-xs text-muted">{[a.type, a.base].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge map={aircraftStatus} value={a.status} />
          <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: risk.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: risk.color }} />
            {risk.label}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${a.engines.length}, minmax(0, 1fr))` }}>
        {a.engines.map((e) => {
          const tone = ehiTone(e.ehi);
          return (
            <div key={e.position} className="rounded-lg border border-border bg-background/40 px-2 py-1.5 text-center" title={e.serial ?? "Empty position"}>
              <p className="font-mono text-[10px] text-muted">#{e.position}</p>
              <p className="font-mono text-base tabular-nums" style={{ color: e.serial ? tone.color : "var(--muted)" }}>{e.serial ? (e.ehi ?? "—") : "—"}</p>
              <p className="flex items-center justify-center gap-1 truncate font-mono text-[9px] text-muted">
                {e.monitor && e.monitor !== "normal" && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: monitorLevel[e.monitor].color }} />}
                {e.serial ? e.serial.slice(-4) : "empty"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-right font-mono text-[9px] tracking-wider text-muted">ENGINE EHI · SERIAL</p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Fact icon={<ShieldAlert size={13} />} label="Defects" value={`${a.defects.critical + a.defects.major + a.defects.minor}`} sub={a.defects.critical ? `${a.defects.critical} critical` : a.defects.major ? `${a.defects.major} major` : "none serious"} alert={a.defects.critical > 0} />
        <Fact icon={<ClipboardList size={13} />} label="Work" value={`${a.wos.active}`} sub={a.wos.aog ? `${a.wos.aog} AOG` : "active WOs"} alert={a.wos.aog > 0} />
        <Fact icon={<Wrench size={13} />} label="Maint." value={`${a.tasks.overdue}`} sub={a.tasks.overdue ? "overdue" : `${a.tasks.dueSoon} due soon`} alert={a.tasks.overdue > 0} />
      </dl>

      {a.issues.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
          {a.issues.slice(0, 3).map((t, i) => (
            <li key={i} className="truncate">• {t}</li>
          ))}
          {a.issues.length > 3 && <li>+{a.issues.length - 3} more</li>}
        </ul>
      )}
      {a.nextDowntime && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock size={13} className="text-accent" />
          Next: <span className="truncate">{a.nextDowntime.what}</span>
          <span className={`ml-auto font-mono ${a.nextDowntime.overdue ? "text-danger" : ""}`}>{a.nextDowntime.overdue ? "overdue" : a.nextDowntime.date}</span>
        </p>
      )}
    </Link>
  );
}

function Fact({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub: string; alert: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2/50 px-2.5 py-2">
      <dt className="flex items-center gap-1 text-muted">{icon} {label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums" style={alert ? { color: "var(--danger)" } : undefined}>{value}</dd>
      <dd className="truncate text-[10px]" style={{ color: alert ? "var(--danger)" : "var(--muted)" }}>{sub}</dd>
    </div>
  );
}
