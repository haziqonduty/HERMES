"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { friendlyError } from "@/lib/db-errors";
import { fetchAll } from "@/lib/fetch-all";
import { validateImport, type ImportKind, type ImportResult, type ImportRow } from "@/lib/import";
import { isoDate, requestNow } from "@/lib/now";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const blankToNull = (v: string | undefined) => (v === undefined || v === "" ? null : v);
/** Only the columns that have a value — on existing records a blank cell leaves the stored value unchanged. */
const filled = (values: Record<string, string>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => values[k] !== undefined && values[k] !== "").map((k) => [k, values[k]]));

/** Runs async jobs a few at a time (row-by-row updates/installs without flooding the API). */
async function inBatches<T>(items: T[], size: number, job: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(job));
}

export async function importData(kind: ImportKind, text: string): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") return { ok: false, error: "Only administrators can import data." };

  const today = isoDate(await requestNow());
  const { rows, fileErrors } = validateImport(kind, text, today);
  if (rows.length === 0) return { ok: false, error: fileErrors.join(" ") || "No rows to import." };
  const bad = rows.filter((r) => r.errors.length);
  if (bad.length) return { ok: false, error: `${bad.length} row${bad.length > 1 ? "s have" : " has"} errors — fix them in the file and try again. Nothing was imported.` };

  const supabase = await createClient();
  const result = kind === "aircraft" ? await importAircraft(supabase, rows) : await importEngines(supabase, rows, today);
  if (result.ok) refresh();
  return result;
}

const AIRCRAFT_FIELDS = ["aircraft_type", "serial_number", "squadron", "base", "status", "total_hours", "total_cycles", "engine_positions"];

async function importAircraft(supabase: Supabase, rows: ImportRow[]): Promise<ImportResult> {
  const existing = await fetchAll<{ id: string; registration: string }>((from, to) =>
    supabase.from("aircraft").select("id, registration").order("id").range(from, to),
  );
  if (existing.error) return { ok: false, error: friendlyError(existing.error) };
  const ids = new Map(existing.data!.map((a) => [a.registration.toUpperCase(), a.id]));

  const toInsert = rows.filter((r) => !ids.has(r.values.registration));
  const toUpdate = rows.filter((r) => ids.has(r.values.registration));

  if (toInsert.length) {
    const { error } = await supabase.from("aircraft").insert(
      toInsert.map(({ values: v }) => ({
        registration: v.registration,
        aircraft_type: v.aircraft_type,
        serial_number: blankToNull(v.serial_number),
        squadron: blankToNull(v.squadron),
        base: blankToNull(v.base),
        status: v.status || "serviceable",
        total_hours: v.total_hours || 0,
        total_cycles: v.total_cycles || 0,
        engine_positions: v.engine_positions || 4,
      })),
    );
    if (error) return { ok: false, error: `Nothing was imported: ${friendlyError(error)}` };
  }

  const rowErrors: { line: number; message: string }[] = [];
  let updated = 0;
  await inBatches(toUpdate, 10, async (r) => {
    const { error } = await supabase.from("aircraft").update(filled(r.values, AIRCRAFT_FIELDS)).eq("id", ids.get(r.values.registration)!);
    if (error) rowErrors.push({ line: r.line, message: friendlyError(error) });
    else updated++;
  });
  return { ok: true, created: toInsert.length, updated, fitted: 0, rowErrors: rowErrors.sort((a, b) => a.line - b.line) };
}

const ENGINE_FIELDS = ["model", "manufacturer", "tsn", "csn", "tso", "cso", "overhaul_interval_hours", "last_overhaul_date", "oil_limit_qph", "notes"];

type ExistingEngine = { id: string; serial_number: string; status: string; engine_installations: { aircraft_id: string; position: number; removed_at: string | null }[] };

async function importEngines(supabase: Supabase, rows: ImportRow[], today: string): Promise<ImportResult> {
  const [engines, aircraft] = await Promise.all([
    fetchAll<ExistingEngine>((from, to) =>
      supabase.from("engines").select("id, serial_number, status, engine_installations(aircraft_id, position, removed_at)").order("id").range(from, to),
    ),
    fetchAll<{ id: string; registration: string; engine_positions: number }>((from, to) =>
      supabase.from("aircraft").select("id, registration, engine_positions").order("id").range(from, to),
    ),
  ]);
  if (engines.error || aircraft.error) return { ok: false, error: friendlyError(engines.error ?? aircraft.error) };

  const bySerial = new Map(engines.data!.map((e) => [e.serial_number.toUpperCase(), e]));
  const acByReg = new Map(aircraft.data!.map((a) => [a.registration.toUpperCase(), a]));

  // Checks that need the database, done before anything is written.
  const problems: string[] = [];
  for (const { line, values: v } of rows) {
    const ex = bySerial.get(v.serial_number);
    const active = ex?.engine_installations.find((i) => i.removed_at === null);
    if (v.aircraft_registration) {
      const ac = acByReg.get(v.aircraft_registration);
      if (!ac) problems.push(`line ${line}: aircraft ${v.aircraft_registration} doesn't exist — import aircraft first`);
      else if (Number(v.position) > ac.engine_positions) problems.push(`line ${line}: ${v.aircraft_registration} has only ${ac.engine_positions} engine positions`);
      else if (active && (active.aircraft_id !== ac.id || active.position !== Number(v.position)))
        problems.push(`line ${line}: ${v.serial_number} is already fitted elsewhere — remove it in HERMES first`);
    } else if (active && v.status) {
      problems.push(`line ${line}: ${v.serial_number} is fitted to an aircraft — remove it in HERMES before changing its status`);
    }
  }
  if (problems.length)
    return { ok: false, error: `Nothing was imported. ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? `; and ${problems.length - 8} more` : ""}.` };

  const toInsert = rows.filter((r) => !bySerial.has(r.values.serial_number));
  const toUpdate = rows.filter((r) => bySerial.has(r.values.serial_number));

  const idBySerial = new Map(engines.data!.map((e) => [e.serial_number.toUpperCase(), e.id]));
  if (toInsert.length) {
    const { data: inserted, error } = await supabase.from("engines").insert(
      toInsert.map(({ values: v }) => ({
        serial_number: v.serial_number,
        model: v.model,
        manufacturer: blankToNull(v.manufacturer),
        // Fitted engines start as spare; install_engine sets "installed".
        status: v.aircraft_registration ? "spare" : v.status || "spare",
        tsn: v.tsn || 0,
        csn: v.csn || 0,
        tso: blankToNull(v.tso),
        cso: blankToNull(v.cso),
        overhaul_interval_hours: blankToNull(v.overhaul_interval_hours),
        last_overhaul_date: blankToNull(v.last_overhaul_date),
        oil_limit_qph: blankToNull(v.oil_limit_qph),
        notes: blankToNull(v.notes),
      })),
    ).select("id, serial_number");
    if (error) return { ok: false, error: `Nothing was imported: ${friendlyError(error)}` };
    for (const e of inserted ?? []) idBySerial.set(e.serial_number.toUpperCase(), e.id);
  }

  const rowErrors: { line: number; message: string }[] = [];
  let updated = 0;
  await inBatches(toUpdate, 10, async ({ line, values: v }) => {
    const ex = bySerial.get(v.serial_number)!;
    const patch: Record<string, string> = filled(v, ENGINE_FIELDS);
    if (v.status && v.status !== "installed" && ex.status !== "installed") patch.status = v.status;
    const { error } = await supabase.from("engines").update(patch).eq("id", ex.id);
    if (error) rowErrors.push({ line, message: friendlyError(error) });
    else updated++;
  });

  // Fit engines to aircraft (skips those already fitted in that position).
  const fittedRows = rows.filter((r) => r.values.aircraft_registration);
  let fitted = 0;
  if (fittedRows.length) {
    // One at a time: installs on the same aircraft must not race each other.
    for (const { line, values: v } of fittedRows) {
      const ex = bySerial.get(v.serial_number);
      if (ex?.engine_installations.some((i) => i.removed_at === null)) continue; // already fitted there
      const { error } = await supabase.rpc("install_engine", {
        p_engine: idBySerial.get(v.serial_number),
        p_aircraft: acByReg.get(v.aircraft_registration)!.id,
        p_position: Number(v.position),
        p_date: v.installed_at || today,
      });
      if (error) rowErrors.push({ line, message: `Created, but not fitted: ${friendlyError(error)}` });
      else fitted++;
    }
  }
  return { ok: true, created: toInsert.length, updated, fitted, rowErrors: rowErrors.sort((a, b) => a.line - b.line) };
}
