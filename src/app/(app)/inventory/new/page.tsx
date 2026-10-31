import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { PartForm } from "../forms";

export const metadata = { title: "Add store item" };

export default async function NewPartPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Inventory
      </Link>
      <PageHeader eyebrow="Inventory" title="Add store item" description="Each part number is held per store location." />
      {canEdit(user.role) ? (
        <div className="panel rounded-2xl p-6 md:p-8">
          <PartForm />
        </div>
      ) : (
        <p className="panel rounded-2xl p-6 text-sm text-muted">Your role can view inventory but not change it.</p>
      )}
    </div>
  );
}
