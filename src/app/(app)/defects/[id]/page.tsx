import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Cog, Plane } from "lucide-react";
import { ButtonLink, StatusBadge } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { DEFECT_COLUMNS, ataChapters, daysBetween, type DefectRecord } from "@/lib/defects";
import { defectSeverity, defectStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";
import { DefectUpdateForm } from "../forms";
import { SetupNotice } from "@/components/setup-notice";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Defect" };

export default async function DefectPage({ params }: PageProps<"/defects/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data: d, error } = await supabase.from("defects").select(DEFECT_COLUMNS).eq("id", id).returns<DefectRecord[]>().maybeSingle();
  if (error?.code === "42703") return <SetupNotice />;
  if (!d) notFound();

  const today = isoDate(await requestNow());
  const age = daysBetween(d.reported_at, d.closed_at ?? today);
  const ata = ataChapters.find((a) => a.code === d.ata_chapter);
  const overdue = d.status === "deferred" && d.deferred_until && d.deferred_until < today;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/defects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All defects
      </Link>

      <section className="panel rounded-2xl p-6 md:p-8">
        <p className="label !text-gold">Defect report</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-mono text-3xl font-semibold tracking-wider">
          {d.defect_no ?? "—"}
          <StatusBadge map={defectSeverity} value={d.severity} />
          <StatusBadge map={defectStatus} value={d.status} />
          {overdue && <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs text-warning">DEFERRAL EXPIRED</span>}
        </h1>
        <p className="mt-4 max-w-3xl text-lg">{d.description}</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          {d.aircraft && (
            <Link href={`/fleet/${encodeURIComponent(d.aircraft.registration)}`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <Plane size={14} className="text-accent" /> <span className="font-mono">{d.aircraft.registration}</span>
            </Link>
          )}
          {d.engines && (
            <Link href={`/engines/${encodeURIComponent(d.engines.serial_number)}?tab=defects`} className="flex items-center gap-1.5 hover:text-gold-soft">
              <Cog size={14} className="text-gold" /> <span className="font-mono">{d.engines.serial_number}</span>
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="panel rounded-2xl p-6">
            <p className="label">Classification</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 text-sm md:grid-cols-3">
              <Item label="ATA chapter" value={d.ata_chapter ? `${d.ata_chapter}${ata ? ` · ${ata.name}` : ""}` : null} />
              <Item label="System" value={d.system} />
              <Item label="Failure mode" value={d.failure_mode ?? "Not yet classified"} />
              <Item label="Detected by" value={d.detection_method} />
              <Item label="Reported" value={d.reported_at} mono />
              <Item label={d.closed_at ? "Closed" : "Age"} value={d.closed_at ? `${d.closed_at} · ${age} days` : `${age} days open`} mono />
              {d.status === "deferred" && <Item label="Deferred until" value={d.deferred_until} mono />}
            </dl>
          </section>

          <section className="panel rounded-2xl p-6">
            <p className="label">Investigation & rectification</p>
            <div className="mt-5 space-y-5 text-sm">
              <div>
                <p className="text-xs text-muted">Root cause</p>
                <p className="mt-1 whitespace-pre-wrap">{d.root_cause ?? <span className="text-muted">Not yet determined.</span>}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Action taken</p>
                <p className="mt-1 whitespace-pre-wrap">{d.action_taken ?? <span className="text-muted">No action recorded.</span>}</p>
              </div>
            </div>
          </section>
        </div>

        {canEdit(user.role) && (
          <div className="space-y-6">
            {d.status !== "closed" && (
              <section className="panel h-fit rounded-2xl p-6">
                <p className="label">Rectification</p>
                <p className="mt-2 text-sm text-muted">Raise a work order to plan the job, sign off task-card steps and issue parts.</p>
                <div className="mt-4">
                  <ButtonLink href={`/work/new?defect=${d.id}`}>
                    <ClipboardList size={14} /> Raise work order
                  </ButtonLink>
                </div>
              </section>
            )}
            <section className="panel h-fit rounded-2xl p-6">
              <p className="label mb-5">Update defect</p>
              <DefectUpdateForm defect={d} today={today} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}
