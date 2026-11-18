import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 20) {
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">Link not valid</h1>
        <p className="mt-1 text-sm text-muted">This reset link is incomplete. Request a new one.</p>
        <Link href="/forgot-password" className="link mt-4 inline-block text-sm">
          Request a new link
        </Link>
      </div>
    );
  }
  return (
    <div className="panel p-6">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">You&apos;ll be signed in and your other sessions will be signed out.</p>
      <ActionForm action={resetPasswordAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password" name="password" hint="At least 10 characters.">
          <Input name="password" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        <Field label="Repeat password" name="confirm">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton pendingLabel="Saving…">Update password</SubmitButton>
      </ActionForm>
    </div>
  );
}
