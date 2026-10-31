import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; name: string; role: string };

const EDIT_ROLES = new Set(["admin", "oc_engineering", "supervisor", "planner", "engineer"]);

/** Mirrors public.can_edit_engineering() in the database. UI hint only — RLS is the real guard. */
export const canEdit = (role: string) => EDIT_ROLES.has(role);

/** Signed-in user with their HERMES profile. Must be called inside a <Suspense> boundary. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // profiles may not exist yet if the migration hasn't been run — fall back gracefully.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, rank, role")
    .eq("id", user.id)
    .maybeSingle();

  // Deactivated accounts can't read their profile; end the session (route handler clears cookies).
  if (!profile) {
    const { data: active, error } = await supabase.rpc("is_active_user");
    if (!error && active === false) redirect("/logout?reason=inactive");
  }

  return {
    id: user.id,
    name: [profile?.rank, profile?.full_name].filter(Boolean).join(" ") || user.email || "User",
    role: profile?.role ?? "viewer",
  };
}
