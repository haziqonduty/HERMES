import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/**
 * Supabase client for server components, actions and route handlers.
 * Supabase data is per user, so `connection()` marks every render that uses it as
 * per-request; this also covers supabase-js reading the clock (Date.now) for
 * session expiry, which Next.js would otherwise flag during prerendering.
 */
export async function createClient() {
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when a proxy refreshes sessions.
          }
        },
      },
    },
  );
}
