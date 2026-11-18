import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { verifyEmailAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Confirm your email" };

/** Confirmation needs one click, so link scanners that prefetch URLs can't consume the token. */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length >= 20;
  return (
    <div className="panel p-6">
      <h1 className="text-xl font-semibold">Confirm your email</h1>
      {valid ? (
        <>
          <p className="mt-1 text-sm text-muted">One last step: confirm this address belongs to you.</p>
          <ActionForm action={verifyEmailAction} className="mt-5 flex flex-col">
            <input type="hidden" name="token" value={token} />
            <SubmitButton pendingLabel="Confirming…">Confirm my email</SubmitButton>
          </ActionForm>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          This link is incomplete. Sign in and use “Resend link” to get a new one.{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
