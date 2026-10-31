import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AircraftForm } from "../../forms";

export async function generateMetadata({ params }: PageProps<"/fleet/[registration]/edit">) {
  return { title: `Edit aircraft ${decodeURIComponent((await params).registration)}` };
}

export default async function EditAircraftPage({ params }: PageProps<"/fleet/[registration]/edit">) {
  const registration = decodeURIComponent((await params).registration);
  const supabase = await createClient();
  const { data: a } = await supabase.from("aircraft").select("*").eq("registration", registration).maybeSingle();
  if (!a) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Fleet Overview" title={`Edit ${a.registration}`} />
      <AircraftForm defaults={a} />
    </div>
  );
}
