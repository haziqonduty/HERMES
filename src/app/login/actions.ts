"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "user_banned") return { error: "This account has been deactivated. Contact your HERMES administrator." };
  if (error) return { error: "Invalid credentials or account not activated." };

  redirect(safeNext(next));
}

/**
 * Only same-site paths are allowed after sign-in. Browsers treat "/\evil.com" like
 * "//evil.com", so a simple startsWith("/") check is not enough (open redirect).
 */
function safeNext(next: string) {
  try {
    const url = new URL(next, "https://hermes.local");
    if (next.startsWith("/") && url.origin === "https://hermes.local" && !next.includes("\\")) return url.pathname + url.search;
  } catch {}
  return "/dashboard";
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
