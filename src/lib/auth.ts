import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; name: string; role: string };

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

  return {
    id: user.id,
    name: [profile?.rank, profile?.full_name].filter(Boolean).join(" ") || user.email || "User",
    role: profile?.role ?? "viewer",
  };
}
