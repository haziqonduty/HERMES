import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isoDate, requestNow } from "@/lib/now";
import { DefectForm } from "../forms";

export const metadata = { title: "Raise defect · Hermes" };

type EngineRow = { id: string; serial_number: string; engine_installations: { aircraft_id: string; removed_at: string | null }[] };

/** Prefill with ?engine=<serial> or ?aircraft=<registration> (linked from the passport and aircraft pages). */
export default async function NewDefectPage({ searchParams }: PageProps<"/defects/new">) {
  const sp = (await searchParams) as { engine?: string; aircraft?: string };
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);

  const [aircraftRes, enginesRes] = await Promise.all([
    supabase.from("aircraft").select("id, registration").order("registration"),
    supabase
      .from("engines")
      .select("id, serial_number, engine_installations(aircraft_id, removed_at)")
      .neq("status", "retired")
      .order("serial_number")
      .returns<EngineRow[]>(),
  ]);
  const aircraft = aircraftRes.data ?? [];
  const engines = (enginesRes.data ?? []).map((e) => ({
    id: e.id,
    serial_number: e.serial_number,
    aircraft_id: e.engine_installations.find((i) => !i.removed_at)?.aircraft_id ?? null,
  }));

  const engine = engines.find((e) => e.serial_number === sp.engine);
  const aircraftId = aircraft.find((a) => a.registration === sp.aircraft)?.id ?? engine?.aircraft_id ?? undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/defects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All defects
      </Link>
      <PageHeader eyebrow="Defect Management" title="Raise defect" description="A defect number is assigned automatically." />
      {canEdit(user.role) ? (
        <DefectForm
          aircraft={aircraft}
          engines={engines}
          defaults={{ aircraftId, engineId: engine?.id }}
          today={isoDate(await requestNow())}
        />
      ) : (
        <p className="panel rounded-2xl p-6 text-sm text-muted">Your role can view defects but not raise them.</p>
      )}
    </div>
  );
}
