import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { isoDate, requestNow } from "@/lib/now";
import { engineStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { EngineForm } from "../../engine-form";
import { EngineStatusForm } from "../../status-form";

export default async function EditEnginePage({ params }: PageProps<"/engines/[serial]/edit">) {
  const serial = decodeURIComponent((await params).serial);
  const supabase = await createClient();
  const { data: e } = await supabase.from("engines").select("*").eq("serial_number", serial).maybeSingle();
  if (!e) notFound();
  const today = isoDate(await requestNow());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Engine Passport" title={`Edit ${e.serial_number}`} />

      <section className="panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="label">Status &amp; overhaul</p>
          <StatusBadge map={engineStatus} value={e.status} />
        </div>
        <div className="mt-5">
          {e.status === "installed" ? (
            <p className="text-sm text-muted">
              This engine is fitted to an aircraft. Remove it from the aircraft page to change its status — the removal records where it goes.
            </p>
          ) : (
            <EngineStatusForm id={e.id} status={e.status} today={today} />
          )}
        </div>
      </section>

      <EngineForm defaults={e} />
    </div>
  );
}
