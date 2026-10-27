"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form";
import { failureModes } from "@/lib/defects";
import { aircraftStatus, engineStatus } from "@/lib/status";
import { installEngine, logFlight, removeEngine, saveAircraft } from "./actions";

const toOptions = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, { label }]) => ({ value, label }));

export type AircraftDefaults = {
  id?: string;
  registration?: string;
  aircraft_type?: string;
  serial_number?: string | null;
  squadron?: string | null;
  base?: string | null;
  status?: string;
  engine_positions?: number;
};

export function AircraftForm({ defaults = {} }: { defaults?: AircraftDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(saveAircraft, {});
  const isNew = !defaults.id;

  return (
    <form action={action} className="panel space-y-6 rounded-2xl p-6 md:p-8">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Registration (tail no.)" name="registration" required defaultValue={defaults.registration} placeholder="M30-07" />
        <Field label="Aircraft type" name="aircraft_type" required defaultValue={defaults.aircraft_type} placeholder="C-130H" />
        <Field label="Manufacturer serial no." name="serial_number" defaultValue={defaults.serial_number ?? ""} />
        <SelectField label="Status" name="status" defaultValue={defaults.status ?? "serviceable"} options={toOptions(aircraftStatus)} />
        <Field label="Squadron" name="squadron" defaultValue={defaults.squadron ?? ""} placeholder="No. 20 Squadron" />
        <Field label="Base" name="base" defaultValue={defaults.base ?? ""} placeholder="Subang" />
        <Field
          label="Engine positions"
          name="engine_positions"
          type="number"
          min={1}
          max={8}
          defaultValue={defaults.engine_positions ?? 4}
          hint="4 for C-130, 2 for twin-engine helicopters"
        />
        {isNew && (
          <>
            <Field label="Airframe hours (FH)" name="total_hours" type="number" step="0.1" min={0} defaultValue={0} hint="Opening balance — later updated from flight logs" />
            <Field label="Airframe cycles" name="total_cycles" type="number" min={0} defaultValue={0} />
          </>
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton>{isNew ? "Add aircraft" : "Save changes"}</SubmitButton>
    </form>
  );
}

export function FlightLogForm({ aircraftId, today }: { aircraftId: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(logFlight, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="aircraft_id" value={aircraftId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="flight_date" type="date" required defaultValue={today} max={today} />
        <Field label="Sortie ref" name="sortie_ref" placeholder="Optional" />
        <Field label="Flight hours" name="flight_hours" type="number" step="0.1" min={0.1} required />
        <Field label="Cycles (landings)" name="cycles" type="number" min={0} defaultValue={1} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Logging…">Log flight</SubmitButton>
    </form>
  );
}

export function InstallForm({
  aircraftId,
  position,
  spares,
  today,
}: {
  aircraftId: string;
  position: number;
  spares: { id: string; serial_number: string; model: string }[];
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(installEngine, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="aircraft_id" value={aircraftId} />
      <input type="hidden" name="position" value={position} />
      <SelectField
        label="Spare engine"
        name="engine_id"
        options={[
          { value: "", label: spares.length ? "Select…" : "No spare engines available" },
          ...spares.map((e) => ({ value: e.id, label: `${e.serial_number} · ${e.model}` })),
        ]}
      />
      <Field label="Install date" name="date" type="date" required defaultValue={today} max={today} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Installing…">Install in #{position}</SubmitButton>
    </form>
  );
}

export function RemoveForm({ installationId, today }: { installationId: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(removeEngine, {});
  const statusOptions = toOptions(engineStatus).filter((o) => o.value !== "installed");
  const [type, setType] = useState("unscheduled");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="installation_id" value={installationId} />
      <Field label="Removal date" name="date" type="date" required defaultValue={today} max={today} />
      <SelectField
        label="Removal type"
        name="removal_type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={[
          { value: "unscheduled", label: "Unscheduled (fault / finding)" },
          { value: "scheduled", label: "Scheduled (hard time, campaign)" },
        ]}
        hint="Drives MTBUR / MTBF in Reliability Analytics"
      />
      {type === "unscheduled" && (
        <>
          <SelectField
            label="Failure mode"
            name="failure_mode"
            options={[{ value: "", label: "Not yet classified" }, ...failureModes.map((m) => ({ value: m, label: m }))]}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="confirmed_failure" className="accent-[var(--gold)]" />
            Failure confirmed (counts towards MTBF)
          </label>
        </>
      )}
      <Field label="Reason" name="reason" required placeholder="e.g. Chip detector finding, scheduled overhaul" />
      <SelectField label="Engine goes to" name="engine_status" defaultValue="unserviceable" options={statusOptions} />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Removing…">Remove engine</SubmitButton>
    </form>
  );
}
