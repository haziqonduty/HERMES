"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_user", {
    p_email: str(fd, "email"),
    p_password: password,
    p_full_name: str(fd, "full_name"),
    p_rank: str(fd, "rank"),
    p_service_no: str(fd, "service_no"),
    p_squadron: str(fd, "squadron"),
    p_role: str(fd, "role") || "viewer",
  });
  if (error) return { error: friendlyError(error) };
  redirect(`/admin/users/${data}`);
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: str(fd, "full_name") || null,
      rank: str(fd, "rank") || null,
      service_no: str(fd, "service_no") || null,
      squadron: str(fd, "squadron") || null,
      role: str(fd, "role"),
      active: fd.get("active") === "on",
    })
    .eq("id", str(fd, "id"))
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Your role does not have permission to do this." };
  refresh();
  return { ok: "User updated." };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_password", { p_user: str(fd, "id"), p_password: password });
  if (error) return { error: friendlyError(error) };
  return { ok: "Password changed. Give it to the user securely and ask them to change it." };
}
