import Link from "next/link";
import { ArrowRight, CalendarClock, Cog, Download, FileText, Star } from "lucide-react";
import { PageHeader, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reports" };

const exports = [
  { key: "engines", label: "Engines", hint: "Life, status, EHI" },
  { key: "aircraft", label: "Aircraft", hint: "Fleet register" },
  { key: "defects", label: "Defects", hint: "All defects with classification" },
  { key: "work-orders", label: "Work orders", hint: "Status, man-hours, links" },
  { key: "maintenance", label: "Maintenance programme", hint: "Tasks with next-due projection" },
  { key: "parts", label: "Store items", hint: "Stock and reorder levels" },
  { key: "movements", label: "Stock movements", hint: "Full ledger" },
];

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: engines } = await supabase.from("engines").select("serial_number, status").neq("status", "retired").order("serial_number");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Reports"
        title="Engineering Reports"
        description="Printable reports (Print → Save as PDF) and CSV exports for Excel."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          href="/reports/brief"
          icon={<Star size={20} />}
          title="Commander Brief"
          text="One-page readiness brief: bottom line, aircraft status and risk, risks needing a decision, and planned downtime."
        />
        <ReportCard
          href="/reports/summary"
          icon={<FileText size={20} />}
          title="Engineering Summary"
          text="Fleet readiness, engine health, condition-monitoring findings, open defects, maintenance due, work in progress and supply shortfalls."
        />
        <ReportCard
          href="/reports/forecast"
          icon={<CalendarClock size={20} />}
          title="Maintenance Forecast"
          text="Programme tasks overdue or due in the next 90 days, and engines reaching overhaul in the next 12 months."
        />
        <div className="panel flex flex-col rounded-2xl p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Cog size={20} />
          </div>
          <h2 className="mt-4 text-lg font-medium">Engine Report</h2>
          <p className="mt-1 flex-1 text-sm text-muted">Digital passport summary for one engine: life, health, monitoring, defects, removals and maintenance.</p>
          <form action="/reports/engine" className="mt-5 flex gap-2">
            <select
              name="serial"
              required
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-gold/60 [&>option]:bg-surface"
            >
              {(engines ?? []).map((e) => (
                <option key={e.serial_number} value={e.serial_number}>{e.serial_number}</option>
              ))}
            </select>
            <button type="submit" className={buttonClass("primary")}>Open</button>
          </form>
        </div>
      </div>

      <section className="panel rounded-2xl p-6">
        <p className="label">CSV exports</p>
        <p className="mt-1 text-sm text-muted">Current data, one file per dataset. Opens directly in Excel.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {exports.map((x) => (
            <a
              key={x.key}
              href={`/reports/export/${x.key}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-gold/50"
            >
              <span>
                <span className="block text-sm group-hover:text-gold-soft">{x.label}</span>
                <span className="block text-xs text-muted">{x.hint}</span>
              </span>
              <Download size={16} className="shrink-0 text-muted group-hover:text-gold" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportCard({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="panel group flex flex-col rounded-2xl p-6 transition hover:border-gold/40">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">{icon}</div>
      <h2 className="mt-4 text-lg font-medium">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-gold-soft">
        Open report <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
