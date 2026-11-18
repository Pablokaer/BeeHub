"use client";

import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { signupAction } from "@/app/actions/auth";

/** Core credentials only; links and other details are added on the profile setup page. */
export function SignupForm() {
  return (
    <ActionForm action={signupAction} className="mt-5 flex flex-col gap-4">
      <Field label="Name" name="displayName">
        <Input name="displayName" autoComplete="name" required autoFocus minLength={2} maxLength={80} />
      </Field>
      <Field label="Email" name="email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" hint="At least 10 characters. A short sentence works well.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="link" target="_blank">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="link" target="_blank">
          Privacy Policy
        </Link>
        .
      </p>
    </ActionForm>
  );
}
