"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form";
import { engineStatus } from "@/lib/status";
import { setEngineStatus } from "./actions";

/** Status of an engine in store: spare, in overhaul, unserviceable or retired (installed is set by install/remove). */
export function EngineStatusForm({ id, status, today }: { id: string; status: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(setEngineStatus, {});
  const [overhauled, setOverhauled] = useState(false);
  const options = Object.entries(engineStatus)
    .filter(([k]) => k !== "installed")
    .map(([value, { label }]) => ({ value, label }));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <SelectField label="Status" name="status" defaultValue={status === "in_overhaul" && overhauled ? "spare" : status} key={String(overhauled)} options={options} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="overhauled" checked={overhauled} onChange={(e) => setOverhauled(e.target.checked)} className="accent-[var(--gold)]" />
        Overhaul completed — reset TSO and CSO to 0
      </label>
      {overhauled && <Field label="Overhaul completed on" name="overhaul_date" type="date" required defaultValue={today} max={today} />}
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Update status</SubmitButton>
    </form>
  );
}
