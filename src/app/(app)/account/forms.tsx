"use client";

import { useActionState, useRef } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { changeMyPassword, updateMyProfile } from "./actions";

type Profile = { full_name: string | null; rank: string | null; service_no: string | null; squadron: string | null };

export function MyProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<FormState, FormData>(updateMyProfile, {});
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Rank" name="rank" defaultValue={profile.rank ?? ""} placeholder="e.g. Capt" />
        <Field label="Full name" name="full_name" defaultValue={profile.full_name ?? ""} />
        <Field label="Service no." name="service_no" defaultValue={profile.service_no ?? ""} />
        <Field label="Squadron" name="squadron" defaultValue={profile.squadron ?? ""} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await changeMyPassword(prev, fd);
    // Don't leave passwords sitting in the fields after a successful change.
    if (result.ok) ref.current?.reset();
    return result;
  }, {});
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="Current password" name="current" type="password" required autoComplete="current-password" />
      <Field label="New password" name="password" type="password" required minLength={10} autoComplete="new-password" hint="At least 10 characters" />
      <Field label="Confirm new password" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Changing…">Change password</SubmitButton>
    </form>
  );
}
