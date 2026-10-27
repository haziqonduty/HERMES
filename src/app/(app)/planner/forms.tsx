"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import type { AircraftOption, EngineOption } from "@/lib/assets";
import { ataChapters } from "@/lib/defects";
import type { MaintenanceTask } from "@/lib/maintenance";
import { saveTask } from "./actions";

export function TaskForm({
  task,
  aircraft = [],
  engines = [],
  defaults = {},
  today,
  compact = false,
}: {
  /** Editing an existing task (asset is fixed). */
  task?: MaintenanceTask;
  aircraft?: AircraftOption[];
  engines?: EngineOption[];
  defaults?: { engineId?: string; aircraftId?: string };
  today: string;
  /** Single-column layout for a side panel. */
  compact?: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveTask, {});
  const [appliesTo, setAppliesTo] = useState(defaults.aircraftId && !defaults.engineId ? "aircraft" : "engine");

  return (
    <form action={action} className="space-y-8">
      {task && <input type="hidden" name="id" value={task.id} />}

      {!task && (
        <FormSection compact={compact} title="Applies to">
          <SelectField
            label="Asset type"
            name="applies_to"
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
            options={[
              { value: "engine", label: "Engine (counts engine TSN / CSN)" },
              { value: "aircraft", label: "Aircraft (counts airframe hours / cycles)" },
            ]}
          />
          {appliesTo === "engine" ? (
            <SelectField
              label="Engine"
              name="engine_id"
              defaultValue={defaults.engineId ?? ""}
              options={[{ value: "", label: "Select engine…" }, ...engines.map((e) => ({ value: e.id, label: e.serial_number }))]}
            />
          ) : (
            <SelectField
              label="Aircraft"
              name="aircraft_id"
              defaultValue={defaults.aircraftId ?? ""}
              options={[{ value: "", label: "Select aircraft…" }, ...aircraft.map((a) => ({ value: a.id, label: a.registration }))]}
            />
          )}
        </FormSection>
      )}

      <FormSection compact={compact} title="Task">
        <Field label="Title" name="title" required defaultValue={task?.title} className={compact ? "" : "md:col-span-2"} placeholder="e.g. Chip detector inspection" />
        <Field label="Task reference" name="task_ref" defaultValue={task?.task_ref ?? ""} placeholder="Task card / programme ref" />
        <Field label="ATA chapter" name="ata_chapter" list="ata-chapters" defaultValue={task?.ata_chapter ?? ""} placeholder="79" />
        <datalist id="ata-chapters">
          {ataChapters.map((a) => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </datalist>
      </FormSection>

      <FormSection compact={compact} title="Interval — whichever comes first" cols={3}>
        <Field label="Flight hours" name="interval_hours" type="number" step="0.1" min="0.1" defaultValue={task?.interval_hours ?? ""} />
        <Field label="Cycles" name="interval_cycles" type="number" step="1" min="1" defaultValue={task?.interval_cycles ?? ""} />
        <Field label="Calendar days" name="interval_days" type="number" step="1" min="1" defaultValue={task?.interval_days ?? ""} />
      </FormSection>

      <FormSection compact={compact} title="Last done" cols={3}>
        <Field label="Date" name="last_done_date" type="date" max={today} defaultValue={task?.last_done_date ?? ""} />
        <Field label="At hours" name="last_done_hours" type="number" step="0.1" min="0" defaultValue={task?.last_done_hours ?? ""} hint="Asset life hours at compliance" />
        <Field label="At cycles" name="last_done_cycles" type="number" step="1" min="0" defaultValue={task?.last_done_cycles ?? ""} />
        <p className={`text-xs text-muted ${compact ? "" : "md:col-span-3"}`}>
          Updated automatically when a work order raised from this task is completed. Leave blank for a new task with no compliance yet.
        </p>
      </FormSection>

      <div className="space-y-4">
        <TextArea label="Notes" name="notes" defaultValue={task?.notes ?? ""} className="[&_textarea]:min-h-16" />
        {task && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={task.active} className="accent-[var(--gold)]" />
            Active in the maintenance programme
          </label>
        )}
      </div>

      <FormMessage state={state} />
      <SubmitButton>{task ? "Save task" : "Add to programme"}</SubmitButton>
    </form>
  );
}

function FormSection({ title, children, cols = 2, compact }: { title: string; children: React.ReactNode; cols?: 2 | 3; compact: boolean }) {
  return (
    <fieldset>
      <legend className="font-mono text-xs tracking-[0.2em] text-gold">{title.toUpperCase()}</legend>
      <div className={`mt-4 grid gap-5 ${compact ? "" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>{children}</div>
    </fieldset>
  );
}
