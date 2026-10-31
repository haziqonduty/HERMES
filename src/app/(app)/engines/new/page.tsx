import { PageHeader } from "@/components/ui";
import { EngineForm } from "../engine-form";

export const metadata = { title: "New engine" };

export default function NewEnginePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Engine Passport" title="New engine passport" />
      <EngineForm />
    </div>
  );
}
