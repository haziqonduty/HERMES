import "server-only";
import { connection } from "next/server";

/**
 * The current time for this request. `connection()` marks the render as per-request,
 * so Next.js (Cache Components) never freezes a timestamp into a prerendered page.
 * Use this instead of `new Date()` in server components.
 */
export async function requestNow() {
  await connection();
  return new Date();
}
