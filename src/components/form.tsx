"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export type FormState = { error?: string; ok?: string };

const inputClass =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-gold/60 placeholder:text-muted/50";

type Base = { label: string; name: string; hint?: string; className?: string };

export function Field({ label, hint, className, ...input }: Base & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <input {...input} className={`mt-1.5 ${inputClass}`} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className,
  options,
  ...select
}: Base & { options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <select {...select} className={`mt-1.5 ${inputClass} [&>option]:bg-surface`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className, ...area }: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <textarea {...area} className={`mt-1.5 min-h-24 ${inputClass}`} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant)}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
    );
  if (state.ok)
    return (
      <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{state.ok}</p>
    );
  return null;
}
