import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getViewer()) redirect("/feed");
  return (
    <div className="panel p-6">
      <h1 className="text-xl font-semibold">Join BeeHub</h1>
      <p className="mt-1 text-sm text-muted">One account for your profile, your projects and the organizations you run.</p>
      <SignupForm />
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="link font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
