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

/** HERMES users work in Malaysia time; "today" and date defaults follow it (the database clock does too, see 0009). */
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date (YYYY-MM-DD) of an instant in Malaysia time — use instead of toISOString().slice(0, 10), which is UTC. */
export const isoDate = (d: Date) => dayFormat.format(d);
