import Link from "next/link";
import { auditAction, auditChanges, auditTables, auditTime, recordHref, recordLabel, type AuditRow } from "@/lib/audit";
import { StatusBadge, Table } from "./ui";

/** Audit trail rows: when, who, what, which record, and the field-level changes. */
export function AuditTable({ rows, actors, showActor = true }: { rows: AuditRow[]; actors: Map<string, string>; showActor?: boolean }) {
  return (
    <Table
      head={["When (MYT)", ...(showActor ? ["User"] : []), "Action", "Area", "Record", "Changes"]}
      empty="No audit entries match."
      rows={rows.map((r) => {
        const data = r.new_data ?? r.old_data;
        const href = r.action !== "DELETE" ? recordHref(r.table_name, data, r.record_id) : null;
        const label = recordLabel(r.table_name, data);
        const changes = r.action === "UPDATE" ? auditChanges(r.old_data, r.new_data) : [];
        return [
          <span key="t" className="whitespace-nowrap font-mono text-xs text-muted">{auditTime(r.at)}</span>,
          ...(showActor
            ? [
                r.actor ? (
                  <Link key="u" href={`/admin/users/${r.actor}`} className="whitespace-nowrap hover:text-gold-soft">{actors.get(r.actor) ?? "Unknown user"}</Link>
                ) : (
                  <span key="u" className="whitespace-nowrap text-muted">System</span>
                ),
              ]
            : []),
          <StatusBadge key="a" map={auditAction} value={r.action} />,
          <span key="tb" className="whitespace-nowrap text-muted">{auditTables[r.table_name] ?? r.table_name}</span>,
          href ? (
            <Link key="r" href={href} className="block min-w-40 max-w-64 truncate hover:text-gold-soft">{label}</Link>
          ) : (
            <span key="r" className="block min-w-40 max-w-64 truncate">{label}</span>
          ),
          changes.length ? (
            <ul key="c" className="min-w-64 space-y-0.5 text-xs">
              {changes.slice(0, 6).map((c) => (
                <li key={c.field}>
                  <span className="text-muted">{c.field}:</span> <span className="font-mono text-danger/80 line-through decoration-danger/40">{c.from}</span>{" "}
                  → <span className="font-mono text-foreground">{c.to}</span>
                </li>
              ))}
              {changes.length > 6 && <li className="text-muted">+{changes.length - 6} more</li>}
            </ul>
          ) : (
            <span key="c" className="text-xs text-muted">{r.action === "INSERT" ? "New record" : r.action === "DELETE" ? "Record removed" : "No field changes"}</span>
          ),
        ];
      })}
    />
  );
}
