"use client";

import { useActionState, useState } from "react";
import { AssetPicker } from "@/components/asset-picker";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import type { AircraftOption, EngineOption } from "@/lib/assets";
import { fmtQty, woKind, woPriority, woStatus } from "@/lib/maintenance";
import { addStep, createWorkOrder, issuePart, updateWorkOrder } from "./actions";

const toOptions = (m: Record<string, { label: string }>, keys?: string[]) =>
  Object.entries(m)
    .filter(([k]) => !keys || keys.includes(k))
    .map(([value, { label }]) => ({ value, label }));

export type WorkOrderDefaults = {
  title?: string;
  description?: string;
  kind?: string;
  priority?: string;
  aircraftId?: string;
  engineId?: string;
  defectId?: string;
  defectLabel?: string;
  taskId?: string;
  taskLabel?: string;
  steps?: string;
};

export function WorkOrderForm({
  aircraft,
  engines,
  defaults,
  today,
}: {
  aircraft: AircraftOption[];
  engines: EngineOption[];
  defaults: WorkOrderDefaults;
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createWorkOrder, {});

  return (
    <form action={action} className="panel space-y-8 rounded-2xl p-6 md:p-8">
      {(defaults.defectId || defaults.taskId) && (
        <div className="space-y-1 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
          {defaults.defectId && (
            <p>
              <span className="label mr-2">Rectifies</span>
              {defaults.defectLabel}
            </p>
          )}
          {defaults.taskId && (
            <p>
              <span className="label mr-2">Carries out</span>
              {defaults.taskLabel}
              <span className="ml-2 text-xs text-muted">— completing this WO records the task as done</span>
            </p>
          )}
          <input type="hidden" name="defect_id" value={defaults.defectId ?? ""} />
          <input type="hidden" name="task_id" value={defaults.taskId ?? ""} />
        </div>
      )}

      <Section title="Work">
        <Field label="Title" name="title" required defaultValue={defaults.title} className="md:col-span-2" placeholder="e.g. Replace igniter plugs — No.3 engine" />
        <TextArea label="Description" name="description" defaultValue={defaults.description} className="md:col-span-2" placeholder="Scope, references, special instructions" />
        <SelectField label="Type" name="kind" defaultValue={defaults.kind ?? "unscheduled"} options={toOptions(woKind)} />
        <SelectField label="Priority" name="priority" defaultValue={defaults.priority ?? "routine"} options={toOptions(woPriority)} hint="AOG = aircraft on ground" />
      </Section>

      <Section title="Asset">
        <AssetPicker aircraft={aircraft} engines={engines} defaults={defaults} />
      </Section>

      <Section title="Planning">
        <SelectField label="Initial status" name="status" defaultValue="open" options={toOptions(woStatus, ["planned", "open"])} />
        <Field label="Due date" name="due_date" type="date" min={today} />
        <Field label="Assigned to" name="assigned_to" placeholder="e.g. Engine shop / Sgt Rahman" />
        <Field label="Estimated man-hours" name="est_hours" type="number" step="0.5" min="0" />
        <TextArea
          label="Task-card steps"
          name="steps"
          defaultValue={defaults.steps}
          className="md:col-span-2"
          hint="One step per line. Each step is signed off individually; all must be signed off to complete the WO."
          placeholder={"Open cowlings and make safe\nInspect per task card\nClose cowlings and ground run"}
        />
      </Section>

      <FormMessage state={state} />
      <SubmitButton pendingText="Raising…">Raise work order</SubmitButton>
    </form>
  );
}

export function WorkOrderUpdateForm({
  wo,
  hasDefect,
  defectOpen,
}: {
  wo: { id: string; status: string; priority: string; due_date: string | null; assigned_to: string | null; actual_hours: number | null; completion_notes: string | null };
  hasDefect: boolean;
  defectOpen: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateWorkOrder, {});
  const [status, setStatus] = useState(wo.status);
  const finishing = status === "completed" || status === "cancelled";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={wo.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={toOptions(woStatus)} />
        <SelectField label="Priority" name="priority" defaultValue={wo.priority} options={toOptions(woPriority)} />
        <Field label="Due date" name="due_date" type="date" defaultValue={wo.due_date ?? ""} />
        <Field label="Actual man-hours" name="actual_hours" type="number" step="0.5" min="0" defaultValue={wo.actual_hours ?? ""} />
      </div>
      <Field label="Assigned to" name="assigned_to" defaultValue={wo.assigned_to ?? ""} />
      <TextArea
        label={status === "cancelled" ? "Reason for cancelling" : "Work carried out"}
        name="completion_notes"
        defaultValue={wo.completion_notes ?? ""}
        className="[&_textarea]:min-h-20"
        hint={finishing ? "Required" : undefined}
      />
      {status === "completed" && hasDefect && defectOpen && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="close_defect" defaultChecked className="accent-[var(--gold)]" />
          Also close the linked defect with this action
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton variant={status === "completed" ? "primary" : "secondary"}>
        {status === "completed" && wo.status !== "completed" ? "Complete work order" : "Save update"}
      </SubmitButton>
    </form>
  );
}

export function AddStepForm({ workOrderId }: { workOrderId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addStep, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="flex gap-2">
        <input
          name="instruction"
          required
          placeholder="Add a step…"
          className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-gold/60"
        />
        <SubmitButton variant="secondary" pendingText="…">Add</SubmitButton>
      </div>
      {state.error && <FormMessage state={state} />}
    </form>
  );
}

export type PartOption = { id: string; part_number: string; description: string; unit: string; quantity: number; location: string };

export function IssuePartForm({ workOrderId, woNo, parts }: { workOrderId: string; woNo: string; parts: PartOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(issuePart, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <input type="hidden" name="wo_no" value={woNo} />
      <SelectField
        label="Part"
        name="part_id"
        options={[
          { value: "", label: "Select part…" },
          ...parts.map((p) => ({ value: p.id, label: `${p.part_number} — ${p.description} (${fmtQty(p.quantity)} ${p.unit} · ${p.location})` })),
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quantity" name="quantity" type="number" step="any" min="0" required />
        <SelectField label="Movement" name="kind" options={[{ value: "issue", label: "Issue to WO" }, { value: "return", label: "Return to store" }]} />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Recording…">Record</SubmitButton>
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
