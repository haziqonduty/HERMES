import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { EngineForm } from "../../engine-form";

export default async function EditEnginePage({ params }: PageProps<"/engines/[serial]/edit">) {
  const serial = decodeURIComponent((await params).serial);
  const supabase = await createClient();
  const { data: e } = await supabase.from("engines").select("*").eq("serial_number", serial).maybeSingle();
  if (!e) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Engine Passport" title={`Edit ${e.serial_number}`} />
      <EngineForm defaults={e} />
    </div>
  );
}
