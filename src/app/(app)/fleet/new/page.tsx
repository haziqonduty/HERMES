import { PageHeader } from "@/components/ui";
import { AircraftForm } from "../forms";

export const metadata = { title: "Add aircraft" };

export default function NewAircraftPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Fleet Overview" title="Add aircraft" />
      <AircraftForm />
    </div>
  );
}
