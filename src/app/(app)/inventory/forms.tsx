"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import { movementKind, partCategory, type Part } from "@/lib/maintenance";
import { recordMovement, savePart } from "./actions";

const toOptions = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, { label }]) => ({ value, label }));

export function PartForm({ part, compact = false }: { part?: Part; compact?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(savePart, {});
  const grid = compact ? "grid gap-4" : "grid gap-5 md:grid-cols-2";

  return (
    <form action={action} className="space-y-5">
      {part && <input type="hidden" name="id" value={part.id} />}
      <div className={grid}>
        <Field label="Part number" name="part_number" required defaultValue={part?.part_number} />
        <SelectField label="Category" name="category" defaultValue={part?.category ?? "component"} options={toOptions(partCategory)} />
        <Field label="Description" name="description" required defaultValue={part?.description} className={compact ? "" : "md:col-span-2"} />
        <Field label="Unit of issue" name="unit" defaultValue={part?.unit ?? "ea"} placeholder="ea, qt, kg, set…" />
        <Field label="Reorder level" name="min_quantity" type="number" step="any" min="0" defaultValue={part?.min_quantity ?? 0} />
        <Field label="Location" name="location" defaultValue={part?.location ?? "Main store"} />
        <Field label="Applicability" name="applicability" defaultValue={part?.applicability ?? ""} placeholder="e.g. T56-A-15" />
        {!part && <Field label="Opening stock" name="opening" type="number" step="any" min="0" defaultValue={0} hint="Booked as a receipt" />}
      </div>
      <TextArea label="Notes" name="notes" defaultValue={part?.notes ?? ""} className="[&_textarea]:min-h-16" />
      <FormMessage state={state} />
      <SubmitButton>{part ? "Save item" : "Add item"}</SubmitButton>
    </form>
  );
}

export function MovementForm({ partId, unit, today }: { partId: string; unit: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(recordMovement, {});
  const [kind, setKind] = useState("receipt");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="part_id" value={partId} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Movement" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={toOptions(movementKind)} />
        <Field label={`Quantity (${unit})`} name="quantity" type="number" step="any" min="0" required />
        {kind === "adjustment" && (
          <SelectField label="Direction" name="direction" options={[{ value: "in", label: "Increase (+)" }, { value: "out", label: "Decrease (−)" }]} />
        )}
        <Field label="Date" name="moved_at" type="date" defaultValue={today} max={today} />
        <Field label="Reference" name="reference" placeholder="GRN / demand no." className={kind === "adjustment" ? "col-span-2" : ""} />
      </div>
      <TextArea label={kind === "adjustment" ? "Reason (required)" : "Notes"} name="notes" className="[&_textarea]:min-h-14" />
      <p className="text-xs text-muted">To issue parts against a job, use the work order page so usage is traceable.</p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Recording…">Record movement</SubmitButton>
    </form>
  );
}
