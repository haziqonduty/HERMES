import { AuditTable } from "@/components/audit-table";
import { Badge, PageHeader } from "@/components/ui";
import type { AuditRow } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { roleColor, roleLabels } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm, MyProfileForm } from "./forms";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const [me, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const [{ data: auth }, { data: profile }, activity] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("full_name, rank, service_no, squadron").eq("id", me.id).maybeSingle(),
    supabase.from("audit_log").select("*").eq("actor", me.id).order("at", { ascending: false }).limit(20).returns<AuditRow[]>(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="HERMES · Account" title="My account" description="Your profile, password and recent activity." />

      <section className="panel flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl p-6">
        <div>
          <p className="text-xl font-medium">{me.name}</p>
          <p className="font-mono text-xs text-muted">{auth.user?.email}</p>
        </div>
        <Badge color={roleColor(me.role)}>{roleLabels[me.role] ?? me.role}</Badge>
        <p className="text-xs text-muted md:ml-auto">Your role is set by an administrator.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel rounded-2xl p-6 lg:col-span-2">
          <p className="label mb-5">Profile</p>
          <MyProfileForm profile={profile ?? { full_name: null, rank: null, service_no: null, squadron: null }} />
        </section>
        <section className="panel h-fit rounded-2xl p-6">
          <p className="label mb-5">Change password</p>
          <ChangePasswordForm />
        </section>
      </div>

      <section className="panel overflow-hidden rounded-2xl">
        <p className="label px-6 pt-6">My recent activity</p>
        <div className="mt-3">
          <AuditTable rows={activity.data ?? []} actors={new Map([[me.id, me.name]])} showActor={false} />
        </div>
      </section>
    </div>
  );
}
