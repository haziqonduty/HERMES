import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { loadAssetOptions } from "@/lib/assets";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/now";
import { WorkOrderForm, type WorkOrderDefaults } from "../forms";

export const metadata = { title: "New work order · Hermes" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prefill with ?task=<id> (from the planner), ?defect=<id> (from a defect),
 * or ?engine=<serial> / ?aircraft=<registration>.
 */
export default async function NewWorkOrderPage({ searchParams }: PageProps<"/work/new">) {
  const sp = (await searchParams) as { task?: string; defect?: string; engine?: string; aircraft?: string };
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const today = (await requestNow()).toISOString().slice(0, 10);

  const [{ aircraft, engines }, taskRes, defectRes] = await Promise.all([
    loadAssetOptions(supabase),
    sp.task && UUID.test(sp.task)
      ? supabase.from("maintenance_tasks").select("id, task_ref, title, engine_id, aircraft_id").eq("id", sp.task).maybeSingle()
      : null,
    sp.defect && UUID.test(sp.defect)
      ? supabase.from("defects").select("id, defect_no, description, severity, aircraft_id, engine_id").eq("id", sp.defect).maybeSingle()
      : null,
  ]);

  const task = taskRes?.data;
  const defect = defectRes?.data;
  const engine = engines.find((e) => e.serial_number === sp.engine || e.id === (task?.engine_id ?? defect?.engine_id));
  const aircraftId =
    aircraft.find((a) => a.registration === sp.aircraft)?.id ?? task?.aircraft_id ?? defect?.aircraft_id ?? engine?.aircraft_id ?? undefined;

  let defaults: WorkOrderDefaults = { aircraftId, engineId: engine?.id };
  if (task) {
    const asset = engine?.serial_number ?? aircraft.find((a) => a.id === task.aircraft_id)?.registration;
    defaults = {
      ...defaults,
      title: `${task.title}${asset ? ` — ${asset}` : ""}`,
      kind: "scheduled",
      taskId: task.id,
      taskLabel: [task.task_ref, task.title].filter(Boolean).join(" · "),
    };
  } else if (defect) {
    defaults = {
      ...defaults,
      title: `Rectify: ${defect.description}`,
      kind: "unscheduled",
      priority: defect.severity === "critical" ? "urgent" : "routine",
      defectId: defect.id,
      defectLabel: `${defect.defect_no ?? "Defect"} — ${defect.description}`,
      steps: "Investigate and confirm defect\nRectify per maintenance manual\nFunctional / leak check",
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All work orders
      </Link>
      <PageHeader eyebrow="Work Management" title="New work order" description="A WO number is assigned automatically." />
      {canEdit(user.role) ? (
        <WorkOrderForm aircraft={aircraft} engines={engines} defaults={defaults} today={today} />
      ) : (
        <p className="panel rounded-2xl p-6 text-sm text-muted">Your role can view work orders but not raise them.</p>
      )}
    </div>
  );
}
