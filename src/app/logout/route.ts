import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Ends the session (used when an account is deactivated mid-session) and returns to sign-in. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("reason") === "inactive") url.searchParams.set("error", "inactive");
  return NextResponse.redirect(url);
}
