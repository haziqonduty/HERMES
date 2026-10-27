"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextArea, type FormState } from "@/components/form";
import { ehiComponents } from "@/lib/health";
import { recordAssessment } from "./actions";

const sources = ["Oil analysis", "Chip detector inspection", "Borescope", "Vibration survey", "Ground run", "Trend monitoring", "Other"];

/** Mirrors the generated EHI column so the engineer sees the result before saving. */
function previewEhi(s: Record<string, number>) {
  const weighted = Math.round(ehiComponents.reduce((t, c) => t + (s[c.key] ?? 0) * c.weight, 0) / 100);
  return Math.min(weighted, Math.min(...ehiComponents.map((c) => s[c.key] ?? 0)) + 25);
}

export function AssessmentForm({ engineId, today, latest }: { engineId: string; today: string; latest?: Record<string, number> }) {
  const [state, action] = useActionState<FormState, FormData>(recordAssessment, {});
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(ehiComponents.map((c) => [c.key, latest?.[c.key] ?? 80])),
  );
  const ehi = previewEhi(scores);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="engine_id" value={engineId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="assessed_at" type="date" required defaultValue={today} max={today} />
        <SelectField label="Source" name="source" options={sources.map((s) => ({ value: s, label: s }))} />
      </div>

      <div className="space-y-3">
        {ehiComponents.map((c) => (
          <label key={c.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="text-muted">
              {c.label} <span className="font-mono text-[10px]">{c.weight}%</span>
            </span>
            <input
              type="range"
              name={c.key}
              min={0}
              max={100}
              value={scores[c.key]}
              onChange={(e) => setScores({ ...scores, [c.key]: Number(e.target.value) })}
              className="accent-[var(--gold)]"
            />
            <span className="text-right font-mono">{scores[c.key]}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
        <span className="label">Resulting EHI</span>
        <span className="font-mono text-2xl text-gold-soft">{ehi}</span>
      </div>

      <TextArea label="Findings / notes" name="notes" placeholder="e.g. Fe 4.2 ppm, trending up" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Recording…">Record assessment</SubmitButton>
    </form>
  );
}
