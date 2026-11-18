import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { loginAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  if (await getViewer()) redirect("/feed");
  return (
    <div className="panel p-6">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to continue collaborating.</p>
      <ActionForm action={loginAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Password" name="password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="link text-[13px]">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="link font-medium">
          Create an account
        </Link>
      </p>
    </div>
  );
}
