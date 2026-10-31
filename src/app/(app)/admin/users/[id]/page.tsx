import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuditTable } from "@/components/audit-table";
import { SetupNotice } from "@/components/setup-notice";
import { Badge } from "@/components/ui";
import type { AuditRow } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { friendlyError } from "@/lib/db-errors";
import { roleColor, roleLabels } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm, UserEditForm, type UserProfile } from "../../forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ListedUser = UserProfile & { created_at: string; last_sign_in_at: string | null };

export const metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [me, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const canAudit = me.role === "admin" || me.role === "oc_engineering";
  if (!canAudit) notFound();

  const [usersRes, activity, profileChanges] = await Promise.all([
    me.role === "admin" ? supabase.rpc("admin_list_users") : null,
    supabase.from("audit_log").select("*").eq("actor", id).order("at", { ascending: false }).limit(25).returns<AuditRow[]>(),
    supabase.from("audit_log").select("*").eq("table_name", "profiles").eq("record_id", id).order("at", { ascending: false }).limit(10).returns<AuditRow[]>(),
  ]);
  if (usersRes?.error?.code === "PGRST202") return <SetupNotice module="Administration" file="0007_administration.sql" />;
  if (usersRes?.error) return <p className="text-sm text-danger">{friendlyError(usersRes.error)}</p>;

  // OC Engineering sees activity only; the profile itself comes from the admin RPC.
  const u = ((usersRes?.data ?? []) as ListedUser[]).find((x) => x.id === id);
  if (usersRes && !u) notFound();
  const { data: names } = await supabase.from("profiles").select("id, full_name, rank");
  const actors = new Map((names ?? []).map((p) => [p.id as string, [p.rank, p.full_name].filter(Boolean).join(" ") || "(no name)"]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Administration
      </Link>

      <section className="panel rounded-2xl p-6 md:p-8">
        <p className="label !text-gold">User account</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
          {actors.get(id) ?? "Unknown user"}
          {u && <Badge color={roleColor(u.role)}>{roleLabels[u.role] ?? u.role}</Badge>}
          {u && <Badge color={u.active ? "var(--success)" : "var(--danger)"}>{u.active ? "Active" : "Inactive"}</Badge>}
        </h1>
        {u && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 text-sm md:grid-cols-4">
            <Item label="E-mail" value={u.email} />
            <Item label="Service no." value={u.service_no} />
            <Item label="Account created" value={u.created_at.slice(0, 10)} />
            <Item label="Last sign-in" value={u.last_sign_in_at ? u.last_sign_in_at.slice(0, 16).replace("T", " ") : "Never"} />
          </dl>
        )}
      </section>

      {u && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <p className="label mb-5">Profile and role</p>
            <UserEditForm user={u} isSelf={u.id === me.id} />
          </section>
          <section className="panel h-fit rounded-2xl p-6">
            <p className="label mb-5">Reset password</p>
            <ResetPasswordForm id={u.id} />
          </section>
        </div>
      )}

      <section className="panel overflow-hidden rounded-2xl">
        <p className="label px-6 pt-6">Recent activity by this user</p>
        <div className="mt-3">
          <AuditTable rows={activity.data ?? []} actors={actors} showActor={false} />
        </div>
      </section>

      <section className="panel overflow-hidden rounded-2xl">
        <p className="label px-6 pt-6">Changes to this account</p>
        <div className="mt-3">
          <AuditTable rows={profileChanges.data ?? []} actors={actors} />
        </div>
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate font-mono text-xs">{value ?? "—"}</dd>
    </div>
  );
}
