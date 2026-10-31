"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form";
import { roleLabels } from "@/lib/nav";
import { createUser, resetPassword, setModelLimits, updateUser } from "./actions";

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }));

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  rank: string | null;
  service_no: string | null;
  squadron: string | null;
  role: string;
  active: boolean;
};

export function CreateUserForm() {
  const [state, action] = useActionState<FormState, FormData>(createUser, {});
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Rank" name="rank" placeholder="e.g. Capt" />
        <Field label="Full name" name="full_name" required />
        <Field label="Service no." name="service_no" />
        <Field label="Squadron" name="squadron" placeholder="e.g. No. 20 Squadron" />
        <Field label="E-mail (sign-in)" name="email" type="email" required autoComplete="off" className="md:col-span-2" />
        <Field label="Temporary password" name="password" type="password" required minLength={10} autoComplete="new-password" hint="At least 10 characters" />
        <Field label="Confirm password" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
        <SelectField label="Role" name="role" defaultValue="viewer" options={roleOptions} className="md:col-span-2" hint="Controls what the user can change. Everyone active can view." />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create user</SubmitButton>
    </form>
  );
}

export function UserEditForm({ user, isSelf }: { user: UserProfile; isSelf: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updateUser, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={user.id} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Rank" name="rank" defaultValue={user.rank ?? ""} />
        <Field label="Full name" name="full_name" defaultValue={user.full_name ?? ""} />
        <Field label="Service no." name="service_no" defaultValue={user.service_no ?? ""} />
        <Field label="Squadron" name="squadron" defaultValue={user.squadron ?? ""} />
        <SelectField label="Role" name="role" defaultValue={user.role} options={roleOptions} className="md:col-span-2" />
      </div>
      <label className={`flex items-center gap-2 text-sm ${isSelf ? "opacity-60" : ""}`}>
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} className="accent-[var(--gold)]" />
        Account active
        <span className="text-xs text-muted">— {isSelf ? "you can't deactivate yourself" : "inactive users can't sign in or see any data"}</span>
      </label>
      {isSelf && <input type="hidden" name="active" value="on" />}
      <FormMessage state={state} />
      <SubmitButton>Save user</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Field label="New password" name="password" type="password" required minLength={10} autoComplete="new-password" hint="At least 10 characters" />
      <Field label="Confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Changing…">Set password</SubmitButton>
    </form>
  );
}

export function ModelLimitsForm({ model }: { model: string }) {
  const [state, action] = useActionState<FormState, FormData>(setModelLimits, {});
  return (
    <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="model" value={model} />
      <Field label="Oil limit (qt/FH)" name="oil_limit_qph" type="number" step="0.01" min="0.01" placeholder="Unchanged" />
      <Field label="Overhaul interval (FH)" name="overhaul_interval_hours" type="number" step="1" min="1" placeholder="Unchanged" />
      <SubmitButton>Apply to all</SubmitButton>
      <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3">
        <input type="checkbox" name="oil_default" className="accent-[var(--gold)]" />
        Clear the oil limit (use the app default instead)
      </label>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
