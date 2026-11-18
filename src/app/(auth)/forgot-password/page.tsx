import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { forgotPasswordAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="panel p-6">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter your account email and we&apos;ll send you a reset link that works for one hour.</p>
      <ActionForm action={forgotPasswordAction} className="mt-5 flex flex-col gap-4" resetOnSuccess>
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
