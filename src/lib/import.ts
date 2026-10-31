/**
 * CSV import of the fleet baseline (aircraft, engines and where each engine is fitted).
 * Pure functions, shared by the browser preview and the server action so both apply
 * exactly the same rules.
 */

export type ImportKind = "aircraft" | "engines";

type Column = { key: string; label: string; required?: boolean; example: string; hint: string };

export const importColumns: Record<ImportKind, Column[]> = {
  aircraft: [
    { key: "registration", label: "Registration", required: true, example: "M30-01", hint: "Tail number — unique. Existing aircraft are updated." },
    { key: "aircraft_type", label: "Type", required: true, example: "C-130H", hint: "Aircraft type." },
    { key: "serial_number", label: "MSN", example: "4847", hint: "Manufacturer serial number." },
    { key: "squadron", label: "Squadron", example: "No. 20 Sqn", hint: "" },
    { key: "base", label: "Base", example: "Subang", hint: "" },
    { key: "status", label: "Status", example: "serviceable", hint: "serviceable, standby, in_maintenance or unserviceable. Blank = serviceable." },
    { key: "total_hours", label: "Airframe hours", example: "24518.6", hint: "Total airframe hours to date." },
    { key: "total_cycles", label: "Airframe cycles", example: "15210", hint: "Total landings / cycles to date." },
    { key: "engine_positions", label: "Engine positions", example: "4", hint: "Number of engines (1–8). Blank = 4." },
  ],
  engines: [
    { key: "serial_number", label: "Engine S/N", required: true, example: "AE451201", hint: "Unique. Existing engines are updated." },
    { key: "model", label: "Model", required: true, example: "T56-A-15", hint: "Engine model / type." },
    { key: "manufacturer", label: "Manufacturer", example: "Rolls-Royce", hint: "" },
    { key: "status", label: "Status", example: "", hint: "spare, in_overhaul, unserviceable or retired. Leave blank for fitted engines (set by the aircraft columns). Blank = spare." },
    { key: "tsn", label: "TSN", example: "18240.5", hint: "Time since new (FH)." },
    { key: "csn", label: "CSN", example: "11320", hint: "Cycles since new." },
    { key: "tso", label: "TSO", example: "2410.0", hint: "Time since overhaul (FH). Blank if never overhauled." },
    { key: "cso", label: "CSO", example: "1480", hint: "Cycles since overhaul." },
    { key: "overhaul_interval_hours", label: "Overhaul interval", example: "5000", hint: "TBO in FH." },
    { key: "last_overhaul_date", label: "Last overhaul", example: "2023-04-18", hint: "YYYY-MM-DD." },
    { key: "oil_limit_qph", label: "Oil limit", example: "", hint: "Max oil consumption, qt/FH, from the engine manual. Blank = app default." },
    { key: "aircraft_registration", label: "Fitted to", example: "M30-01", hint: "Registration of the aircraft it is fitted to. Blank = not fitted. The aircraft must exist (import aircraft first)." },
    { key: "position", label: "Position", example: "1", hint: "Engine position on that aircraft." },
    { key: "installed_at", label: "Installed on", example: "2024-02-12", hint: "YYYY-MM-DD, not in the future. Blank = today." },
    { key: "notes", label: "Notes", example: "", hint: "" },
  ],
};

export const aircraftStatuses = ["serviceable", "standby", "in_maintenance", "unserviceable"];
export const engineImportStatuses = ["spare", "in_overhaul", "unserviceable", "retired"];
export const MAX_IMPORT_ROWS = 2000;

/** RFC 4180 CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF. Also accepts tab-separated (pasted from Excel). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n"));
  const sep = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export type ImportRow = { line: number; values: Record<string, string>; errors: string[] };
export type ParsedImport = { rows: ImportRow[]; fileErrors: string[] };

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + "T00:00:00Z").toISOString().startsWith(v); // rejects 2024-02-30

/** Parses and validates a CSV. `today` (YYYY-MM-DD, Malaysia time) bounds dates. Headers match keys or labels, any case. */
export function validateImport(kind: ImportKind, text: string, today: string): ParsedImport {
  const cols = importColumns[kind];
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], fileErrors: ["The file is empty."] };

  const header = table[0].map(norm);
  const byName = new Map<string, string>();
  for (const c of cols) { byName.set(c.key, c.key); byName.set(norm(c.label), c.key); }
  const keys = header.map((h) => byName.get(h) ?? null);

  const fileErrors: string[] = [];
  const unknown = table[0].filter((_, i) => keys[i] === null && header[i] !== "");
  if (unknown.length) fileErrors.push(`Unknown column${unknown.length > 1 ? "s" : ""} ignored: ${unknown.join(", ")}.`);
  const missing = cols.filter((c) => c.required && !keys.includes(c.key)).map((c) => c.key);
  if (missing.length) return { rows: [], fileErrors: [...fileErrors, `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template for the exact headings.`] };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], fileErrors: [`Too many rows (${table.length - 1}). Import at most ${MAX_IMPORT_ROWS} at a time.`] };

  const seen = new Map<string, number>();
  const fitted = new Map<string, number>();
  const rows = table.slice(1).map((cells, idx): ImportRow => {
    const values: Record<string, string> = {};
    keys.forEach((k, i) => { if (k) values[k] = (cells[i] ?? "").trim(); });
    const errors: string[] = [];
    const line = idx + 2;
    const v = (k: string) => values[k] ?? "";
    const num = (k: string, label: string, opts: { int?: boolean; min?: number; max?: number; positive?: boolean } = {}) => {
      const raw = v(k).replace(/,/g, "");
      if (raw === "") return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return errors.push(`${label} "${v(k)}" is not a number.`);
      if (opts.int && !Number.isInteger(n)) return errors.push(`${label} must be a whole number.`);
      if (opts.positive && n <= 0) return errors.push(`${label} must be more than 0.`);
      if (n < (opts.min ?? 0)) return errors.push(`${label} can't be negative.`);
      if (opts.max !== undefined && n > opts.max) return errors.push(`${label} must be ${opts.max} or less.`);
      values[k] = String(n);
    };
    const date = (k: string, label: string) => {
      if (v(k) === "") return;
      if (!isDate(v(k))) errors.push(`${label} "${v(k)}" must be a valid date as YYYY-MM-DD.`);
      else if (v(k) > today) errors.push(`${label} can't be in the future.`);
    };

    for (const c of cols) if (c.required && v(c.key) === "") errors.push(`${c.label} is required.`);
    const id = v(cols[0].key).toUpperCase();
    values[cols[0].key] = id;
    if (id) {
      if (seen.has(id)) errors.push(`${cols[0].label} ${id} also appears on line ${seen.get(id)}.`);
      else seen.set(id, line);
    }

    if (kind === "aircraft") {
      values.status = v("status").toLowerCase().replace(/[\s-]+/g, "_");
      if (v("status") && !aircraftStatuses.includes(v("status"))) errors.push(`Status "${v("status")}" must be one of: ${aircraftStatuses.join(", ")}.`);
      num("total_hours", "Airframe hours");
      num("total_cycles", "Airframe cycles", { int: true });
      num("engine_positions", "Engine positions", { int: true, min: 1, max: 8 });
    } else {
      values.status = v("status").toLowerCase().replace(/[\s-]+/g, "_");
      values.aircraft_registration = v("aircraft_registration").toUpperCase();
      const fittedTo = v("aircraft_registration");
      if (v("status") && v("status") !== "installed" && !engineImportStatuses.includes(v("status")))
        errors.push(`Status "${v("status")}" must be one of: ${engineImportStatuses.join(", ")} (or blank for a fitted engine).`);
      if (fittedTo && v("status") && v("status") !== "installed") errors.push(`A fitted engine can't have status "${v("status")}" — leave status blank.`);
      if (!fittedTo && v("status") === "installed") errors.push(`Status "installed" needs the aircraft registration and position.`);
      if (!fittedTo && (v("position") || v("installed_at"))) errors.push(`Position / installed date given but no aircraft registration.`);
      if (fittedTo && !v("position")) errors.push(`Position is required for a fitted engine.`);
      num("position", "Position", { int: true, min: 1, max: 8 });
      if (fittedTo && v("position") && !errors.some((e) => e.startsWith("Position"))) {
        const slot = `${fittedTo}#${v("position")}`;
        if (fitted.has(slot)) errors.push(`Position ${v("position")} on ${fittedTo} is also given on line ${fitted.get(slot)}.`);
        else fitted.set(slot, line);
      }
      num("tsn", "TSN");
      num("csn", "CSN", { int: true });
      num("tso", "TSO");
      num("cso", "CSO", { int: true });
      num("overhaul_interval_hours", "Overhaul interval", { positive: true });
      num("oil_limit_qph", "Oil limit", { positive: true, max: 999 });
      date("last_overhaul_date", "Last overhaul");
      date("installed_at", "Installed on");
      if (v("tso") && v("tsn") && Number(v("tso")) > Number(v("tsn"))) errors.push(`TSO can't be more than TSN.`);
      if (v("cso") && v("csn") && Number(v("cso")) > Number(v("csn"))) errors.push(`CSO can't be more than CSN.`);
    }
    return { line, values, errors };
  });
  return { rows, fileErrors };
}

export function templateCsv(kind: ImportKind) {
  const cols = importColumns[kind];
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cols.map((c) => c.key).join(","), cols.map((c) => quote(c.example)).join(",")].join("\r\n") + "\r\n";
}

export type ImportResult = { ok: boolean; error?: string; created?: number; updated?: number; fitted?: number; rowErrors?: { line: number; message: string }[] };
