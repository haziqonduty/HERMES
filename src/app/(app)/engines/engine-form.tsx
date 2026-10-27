"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import { DEFAULT_OIL_LIMIT_QPH } from "@/lib/monitoring";
import { engineStatus } from "@/lib/status";
import { saveEngine } from "./actions";

export type EngineDefaults = {
  id?: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string | null;
  tsn?: number;
  csn?: number;
  tso?: number | null;
  cso?: number | null;
  overhaul_interval_hours?: number | null;
  last_overhaul_date?: string | null;
  oil_limit_qph?: number | null;
  notes?: string | null;
};

export function EngineForm({ defaults = {} }: { defaults?: EngineDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(saveEngine, {});
  const isNew = !defaults.id;
  const statusOptions = Object.entries(engineStatus)
    .filter(([v]) => v !== "installed")
    .map(([value, { label }]) => ({ value, label }));

  return (
    <form action={action} className="panel space-y-8 rounded-2xl p-6 md:p-8">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <Section title="Identity">
        <Field label="Serial number" name="serial_number" required defaultValue={defaults.serial_number} placeholder="AE451230" />
        <Field label="Model" name="model" required defaultValue={defaults.model} placeholder="T56-A-15" />
        <Field label="Manufacturer" name="manufacturer" defaultValue={defaults.manufacturer ?? ""} placeholder="Rolls-Royce (Allison)" />
        {isNew && (
          <SelectField label="Initial status" name="status" defaultValue="spare" options={statusOptions} hint="Install it from the aircraft page afterwards" />
        )}
      </Section>

      <Section title="Life data">
        <Field label="TSN — time since new (FH)" name="tsn" type="number" step="0.1" min={0} defaultValue={defaults.tsn ?? 0} />
        <Field label="CSN — cycles since new" name="csn" type="number" min={0} defaultValue={defaults.csn ?? 0} />
        <Field label="TSO — time since overhaul (FH)" name="tso" type="number" step="0.1" min={0} defaultValue={defaults.tso ?? ""} />
        <Field label="CSO — cycles since overhaul" name="cso" type="number" min={0} defaultValue={defaults.cso ?? ""} />
        <Field label="Overhaul interval (FH)" name="overhaul_interval_hours" type="number" step="0.1" min={1} defaultValue={defaults.overhaul_interval_hours ?? ""} />
        <Field label="Last overhaul date" name="last_overhaul_date" type="date" defaultValue={defaults.last_overhaul_date ?? ""} />
      </Section>

      <Section title="Monitoring limits">
        <Field
          label="Oil consumption limit (US qt/FH)"
          name="oil_limit_qph"
          type="number"
          step="0.01"
          min={0.01}
          defaultValue={defaults.oil_limit_qph ?? ""}
          placeholder={String(DEFAULT_OIL_LIMIT_QPH)}
          hint={`From the engine maintenance manual. Blank = fleet default ${DEFAULT_OIL_LIMIT_QPH} qt/FH.`}
        />
      </Section>

      <Section title="Notes">
        <TextArea
          label="Notes"
          name="notes"
          defaultValue={defaults.notes ?? ""}
          className="md:col-span-2"
          hint="Engine Health Index is calculated from health assessments on the passport's Health tab."
        />
      </Section>

      <FormMessage state={state} />
      <SubmitButton>{isNew ? "Create engine passport" : "Save changes"}</SubmitButton>
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
