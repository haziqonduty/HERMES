"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import { ataChapters, detectionMethods, failureModes } from "@/lib/defects";
import { defectSeverity, defectStatus } from "@/lib/status";
import { createDefect, updateDefect } from "./actions";

const toOptions = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, { label }]) => ({ value, label }));
const listOptions = (l: string[], blank: string) => [{ value: "", label: blank }, ...l.map((v) => ({ value: v, label: v }))];

export type AircraftOption = { id: string; registration: string };
export type EngineOption = { id: string; serial_number: string; aircraft_id: string | null };

export function DefectForm({
  aircraft,
  engines,
  defaults,
  today,
}: {
  aircraft: AircraftOption[];
  engines: EngineOption[];
  defaults: { aircraftId?: string; engineId?: string };
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createDefect, {});
  const [aircraftId, setAircraftId] = useState(defaults.aircraftId ?? "");
  const [engineId, setEngineId] = useState(defaults.engineId ?? "");
  // Only show engines fitted to the chosen aircraft (plus anything already selected).
  const engineChoices = aircraftId ? engines.filter((e) => e.aircraft_id === aircraftId || e.id === engineId) : engines;

  return (
    <form action={action} className="panel space-y-8 rounded-2xl p-6 md:p-8">
      <Section title="Where">
        <SelectField
          label="Aircraft"
          name="aircraft_id"
          value={aircraftId}
          onChange={(e) => setAircraftId(e.target.value)}
          options={[{ value: "", label: "— Not aircraft-specific —" }, ...aircraft.map((a) => ({ value: a.id, label: a.registration }))]}
        />
        <SelectField
          label="Engine"
          name="engine_id"
          value={engineId}
          onChange={(e) => {
            setEngineId(e.target.value);
            const fitted = engines.find((x) => x.id === e.target.value)?.aircraft_id;
            if (fitted && !aircraftId) setAircraftId(fitted);
          }}
          options={[{ value: "", label: "— Airframe defect (no engine) —" }, ...engineChoices.map((e) => ({ value: e.id, label: e.serial_number }))]}
          hint={aircraftId ? "Engines fitted to this aircraft" : "Picking an engine fills in its aircraft"}
        />
      </Section>

      <Section title="What">
        <TextArea label="Description" name="description" required className="md:col-span-2" placeholder="e.g. Oil seep at reduction gearbox scavenge line" />
        <Field label="ATA chapter" name="ata_chapter" list="ata-chapters" placeholder="79" />
        <datalist id="ata-chapters">
          {ataChapters.map((a) => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </datalist>
        <Field label="System" name="system" placeholder="e.g. Oil" />
        <SelectField label="Severity" name="severity" defaultValue="minor" options={toOptions(defectSeverity)} />
        <SelectField label="Failure mode" name="failure_mode" options={listOptions(failureModes, "Not yet classified")} hint="Used for reliability Pareto analysis" />
        <SelectField label="Detected by" name="detection_method" options={listOptions(detectionMethods, "—")} />
        <Field label="Reported" name="reported_at" type="date" required defaultValue={today} max={today} />
      </Section>

      <FormMessage state={state} />
      <SubmitButton pendingText="Raising…">Raise defect</SubmitButton>
    </form>
  );
}

export function DefectUpdateForm({
  defect,
  today,
}: {
  defect: {
    id: string;
    status: string;
    severity: string;
    failure_mode: string | null;
    root_cause: string | null;
    action_taken: string | null;
    deferred_until: string | null;
  };
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateDefect, {});
  const [status, setStatus] = useState(defect.status);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={defect.id} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={toOptions(defectStatus)} />
        <SelectField label="Severity" name="severity" defaultValue={defect.severity} options={toOptions(defectSeverity)} />
      </div>
      {status === "deferred" && (
        <Field label="Deferred until" name="deferred_until" type="date" required min={today} defaultValue={defect.deferred_until ?? ""} />
      )}
      <SelectField label="Failure mode" name="failure_mode" defaultValue={defect.failure_mode ?? ""} options={listOptions(failureModes, "Not yet classified")} />
      <TextArea label="Root cause" name="root_cause" defaultValue={defect.root_cause ?? ""} className="[&_textarea]:min-h-16" />
      <TextArea
        label="Action taken"
        name="action_taken"
        defaultValue={defect.action_taken ?? ""}
        className="[&_textarea]:min-h-16"
        hint={status === "closed" ? "Required to close the defect" : undefined}
      />
      <FormMessage state={state} />
      <SubmitButton variant={status === "closed" ? "primary" : "secondary"}>
        {status === "closed" && defect.status !== "closed" ? "Close defect" : "Save update"}
      </SubmitButton>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-mono text-xs tracking-[0.2em] text-gold">{title.toUpperCase()}</legend>
      <div className="mt-4 grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}
