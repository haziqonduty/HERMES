"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const error = state.error ?? (params.get("error") === "inactive" ? "Your account has been deactivated. Contact your HERMES administrator." : undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <Field icon={<Mail size={16} />} label="Service email" name="email" type="email" autoComplete="email" />
      <Field icon={<Lock size={16} />} label="Password" name="password" type="password" autoComplete="current-password" />

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-soft to-gold py-3 text-sm font-semibold text-background shadow-[0_0_40px_-10px_var(--gold)] transition hover:brightness-110 disabled:opacity-60"
      >
        <ShieldCheck size={16} />
        {pending ? "Authenticating…" : "Secure sign in"}
      </button>
    </form>
  );
}

function Field({
  icon,
  label,
  ...input
}: { icon: React.ReactNode; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 focus-within:border-gold/60">
        <span className="text-muted">{icon}</span>
        <input
          {...input}
          required
          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted/60"
        />
      </div>
    </label>
  );
}
