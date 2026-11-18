"use client";

import Link from "next/link";
import { ProfileLinksEditor } from "@/components/profile-links-editor";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { signupAction } from "@/app/actions/auth";

/** Core credentials, with optional links before continuing to profile setup. */
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
      <details className="border-y border-line py-3">
        <summary className="cursor-pointer py-1 text-sm font-medium">Add profile links (optional)</summary>
        <div className="pt-4"><ProfileLinksEditor /></div>
      </details>
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
