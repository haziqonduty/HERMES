import type { StatusMeta } from "./status";

/** Failure classification used for Pareto analysis — shared by defects and engine removals. */
export const failureModes = [
  "Oil leak / consumption",
  "Contamination / debris",
  "Bearing wear",
  "Vibration",
  "Blade erosion / damage",
  "FOD",
  "Overtemperature",
  "Fuel system",
  "Control / electrical",
  "Seal / gasket",
  "Corrosion",
  "Other",
];

export const detectionMethods = [
  "Pilot report",
  "Scheduled inspection",
  "Health monitoring",
  "Ground run",
  "Borescope",
  "Oil analysis",
  "Other",
];

/** Common ATA chapters for engine and related systems (suggestions only — free text allowed). */
export const ataChapters = [
  { code: "61", name: "Propellers" },
  { code: "71", name: "Power plant" },
  { code: "72", name: "Engine" },
  { code: "73", name: "Engine fuel & control" },
  { code: "74", name: "Ignition" },
  { code: "75", name: "Air" },
  { code: "76", name: "Engine controls" },
  { code: "77", name: "Engine indicating" },
  { code: "79", name: "Oil" },
  { code: "80", name: "Starting" },
  { code: "29", name: "Hydraulic power" },
  { code: "32", name: "Landing gear" },
];

export const removalType: Record<string, StatusMeta> = {
  scheduled: { label: "Scheduled", color: "var(--accent)" },
  unscheduled: { label: "Unscheduled", color: "var(--warning)" },
};

export type DefectRecord = {
  id: string;
  defect_no: string | null;
  aircraft_id: string | null;
  engine_id: string | null;
  reported_at: string;
  ata_chapter: string | null;
  system: string | null;
  description: string;
  severity: string;
  status: string;
  failure_mode: string | null;
  detection_method: string | null;
  root_cause: string | null;
  action_taken: string | null;
  closed_at: string | null;
  deferred_until: string | null;
  aircraft: { registration: string } | null;
  engines: { serial_number: string } | null;
};

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const DEFECT_COLUMNS =
  "id, defect_no, aircraft_id, engine_id, reported_at, ata_chapter, system, description, severity, status, failure_mode, detection_method, root_cause, action_taken, closed_at, deferred_until, aircraft(registration), engines(serial_number)";
