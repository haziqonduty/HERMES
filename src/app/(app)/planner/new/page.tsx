import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { loadAssetOptions } from "@/lib/assets";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";
import { TaskForm } from "../forms";

export const metadata = { title: "Add maintenance task · Hermes" };

/** Prefill with ?engine=<serial> or ?aircraft=<registration>. */
export default async function NewTaskPage({ searchParams }: PageProps<"/planner/new">) {
  const sp = (await searchParams) as { engine?: string; aircraft?: string };
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { aircraft, engines } = await loadAssetOptions(supabase);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/planner" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Maintenance Planner
      </Link>
      <PageHeader eyebrow="Maintenance Planner" title="Add programme task" description="A repeating task with hour, cycle and/or calendar limits — whichever comes first." />
      {canEdit(user.role) ? (
        <div className="panel rounded-2xl p-6 md:p-8">
          <TaskForm
            aircraft={aircraft}
            engines={engines}
            defaults={{
              engineId: engines.find((e) => e.serial_number === sp.engine)?.id,
              aircraftId: aircraft.find((a) => a.registration === sp.aircraft)?.id,
            }}
            today={isoDate(await requestNow())}
          />
        </div>
      ) : (
        <p className="panel rounded-2xl p-6 text-sm text-muted">Your role can view the programme but not change it.</p>
      )}
    </div>
  );
}
