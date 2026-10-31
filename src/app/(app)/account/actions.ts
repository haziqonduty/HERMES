"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function updateMyProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Your session has expired. Sign in again." };

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: str(fd, "full_name") || null,
      rank: str(fd, "rank") || null,
      service_no: str(fd, "service_no") || null,
      squadron: str(fd, "squadron") || null,
    })
    .eq("id", auth.user.id)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Profile editing isn't enabled yet — ask your administrator to run 0008_my_account.sql." };
  refresh();
  return { ok: "Profile saved." };
}

export async function changeMyPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const current = String(fd.get("current") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 10) return { error: "The new password must be at least 10 characters." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The new passwords don't match." };
  if (password === current) return { error: "Choose a password different from the current one." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Your session has expired. Sign in again." };

  // Confirm the current password before changing it.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: auth.user.email, password: current });
  if (verifyError) return { error: "Your current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "weak_password") return { error: "That password is too weak. Use a longer mix of words, numbers and symbols." };
  if (error) return { error: error.message };
  return { ok: "Password changed. Use the new password next time you sign in." };
}
