import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isoDate, requestNow } from "@/lib/now";
import { ImportPanel } from "./import-panel";

export const metadata = { title: "Import fleet data" };

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin")
    return (
      <div className="panel mx-auto max-w-2xl rounded-2xl p-8">
        <p className="label !text-gold">Restricted</p>
        <h1 className="mt-3 text-xl font-medium">Data import is for administrators</h1>
      </div>
    );
  const today = isoDate(await requestNow());

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin?tab=system" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold-soft">
        <ArrowLeft size={14} /> Administration
      </Link>
      <PageHeader
        eyebrow="HERMES · Go-live"
        title="Import fleet data"
        description="Load the fleet baseline from spreadsheets: aircraft with their airframe hours, then engines with their life counters and where each is fitted. Every row is checked before anything is saved, and every import is recorded in the audit trail."
      />
      <ImportPanel today={today} />
    </div>
  );
}
