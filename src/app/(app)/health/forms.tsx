"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import {
  borescopeAreas,
  borescopeDispositions,
  chipFindings,
  chipLocations,
  monitorLevel,
  oilLevel,
  soapElements,
} from "@/lib/monitoring";
import { recordBorescope, recordChipCheck, recordOilSample, recordOilUplift } from "./actions";

export type EngineOption = { id: string; serial_number: string; oil_limit_qph?: number | null };
type Target = { engineId?: string; engines?: EngineOption[]; today: string };

const toOptions = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, { label }]) => ({ value, label }));
const listOptions = (l: string[]) => l.map((v) => ({ value: v, label: v }));

/** Hidden engine id on the passport; an engine picker on the Health Monitoring page. */
function EnginePicker({ engineId, engines, value, onChange }: Omit<Target, "today"> & { value?: string; onChange?: (id: string) => void }) {
  if (engineId) return <input type="hidden" name="engine_id" value={engineId} />;
  return (
    <SelectField
      label="Engine"
      name="engine_id"
      value={value}
      onChange={onChange && ((e) => onChange(e.target.value))}
      options={[{ value: "", label: "Select engine…" }, ...(engines ?? []).map((e) => ({ value: e.id, label: e.serial_number }))]}
    />
  );
}

export function OilUpliftForm({ engineId, engines, today, limit }: Target & { limit?: number | null }) {
  const [state, action] = useActionState<FormState, FormData>(recordOilUplift, {});
  const [qty, setQty] = useState("");
  const [hours, setHours] = useState("");
  const [picked, setPicked] = useState("");
  const rate = Number(qty) >= 0 && Number(hours) > 0 && qty !== "" ? Number(qty) / Number(hours) : null;
  const engineLimit = engineId ? limit : engines?.find((e) => e.id === picked)?.oil_limit_qph;
  const level = rate != null ? monitorLevel[oilLevel(rate, engineLimit)] : null;

  return (
    <form action={action} className="space-y-4">
      <EnginePicker engineId={engineId} engines={engines} value={picked} onChange={setPicked} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Serviced" name="serviced_at" type="date" required defaultValue={today} max={today} />
        <Field label="Oil added (qt)" name="quantity_qt" type="number" step="0.1" min={0} required value={qty} onChange={(e) => setQty(e.target.value)} />
        <Field
          label="FH since last servicing"
          name="flight_hours"
          type="number"
          step="0.1"
          min={0.1}
          required
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="col-span-2"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
        <span className="label">Consumption</span>
        <span className="font-mono text-lg">
          {rate == null ? "—" : rate.toFixed(2)} <span className="text-xs text-muted">qt/FH</span>
          {level && <span className="ml-2 text-xs" style={{ color: level.color }}>· {level.label}</span>}
        </span>
      </div>
      <Field label="Notes" name="notes" placeholder="Optional" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Recording…">Record oil uplift</SubmitButton>
    </form>
  );
}

export function OilSampleForm({ engineId, engines, today }: Target) {
  const [state, action] = useActionState<FormState, FormData>(recordOilSample, {});
  return (
    <form action={action} className="space-y-4">
      <EnginePicker engineId={engineId} engines={engines} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sampled" name="sampled_at" type="date" required defaultValue={today} max={today} />
        <Field label="Lab reference" name="lab_ref" placeholder="Optional" />
      </div>
      <div>
        <p className="label">Wear metals (ppm)</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {soapElements.map((m) => (
            <label key={m.key} className="block" title={m.name}>
              <span className="font-mono text-[11px] text-muted">{m.label}</span>
              <input
                name={m.key}
                type="number"
                step="0.1"
                min={0}
                className="mt-1 w-full rounded-lg border border-border bg-background/60 px-2 py-2 font-mono text-sm outline-none focus:border-gold/60"
              />
            </label>
          ))}
        </div>
      </div>
      <SelectField label="Result" name="level" defaultValue="normal" options={toOptions(monitorLevel)} hint="As interpreted by the oil analysis lab / engineer" />
      <TextArea label="Recommendation" name="recommendation" placeholder="e.g. Resample in 10 FH" className="[&_textarea]:min-h-16" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Recording…">Record oil sample</SubmitButton>
    </form>
  );
}

export function ChipCheckForm({ engineId, engines, today }: Target) {
  const [state, action] = useActionState<FormState, FormData>(recordChipCheck, {});
  return (
    <form action={action} className="space-y-4">
      <EnginePicker engineId={engineId} engines={engines} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Checked" name="checked_at" type="date" required defaultValue={today} max={today} />
        <SelectField label="Detector" name="location" options={listOptions(chipLocations)} />
      </div>
      <SelectField label="Finding" name="finding" defaultValue="clean" options={toOptions(chipFindings)} hint="Fine particles → caution · flakes or chunks → alert" />
      <Field label="Action taken" name="action_taken" placeholder="e.g. Debris sent for analysis, recheck after 5 FH" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Recording…">Record chip check</SubmitButton>
    </form>
  );
}

export function BorescopeForm({ engineId, engines, today }: Target) {
  const [state, action] = useActionState<FormState, FormData>(recordBorescope, {});
  return (
    <form action={action} className="space-y-4">
      <EnginePicker engineId={engineId} engines={engines} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inspected" name="inspected_at" type="date" required defaultValue={today} max={today} />
        <SelectField label="Area" name="area" options={listOptions(borescopeAreas)} />
      </div>
      <TextArea label="Findings" name="findings" required placeholder="e.g. Minor leading-edge erosion on 3 blades, within limits" className="[&_textarea]:min-h-16" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Disposition" name="disposition" defaultValue="serviceable" options={toOptions(borescopeDispositions)} />
        <Field label="Next inspection due" name="next_due" type="date" min={today} />
      </div>
      <Field label="Task card / work order" name="reference" placeholder="Optional" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Recording…">Record inspection</SubmitButton>
    </form>
  );
}
