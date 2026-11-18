import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { deactivateAccountAction, deleteAccountAction } from "@/app/actions/settings";
import { Panel, SectionTitle } from "@/components/ui/misc";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Your data" };

export default async function DataSettingsPage() {
  await requireViewerPage("/settings/data");
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <SectionTitle>Download your data</SectionTitle>
        <p className="text-sm text-muted">A JSON file with your account, profile, posts, comments, applications, messages you sent, follows, connections and sessions.</p>
        <a href="/api/me/export" className={buttonClass("secondary", "sm", "mt-3")} download>
          <Download className="size-4" aria-hidden /> Download JSON
        </a>
      </Panel>
      <Panel>
        <SectionTitle>Deactivate account</SectionTitle>
        <p className="text-sm text-muted">Your profile, posts and activity are hidden until you sign in again. Nothing is deleted.</p>
        <ActionForm action={deactivateAccountAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Confirm with your password" name="currentPassword">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton variant="secondary">Deactivate</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel className="border-danger/40">
        <SectionTitle>Delete account permanently</SectionTitle>
        <p className="text-sm text-muted">
          This erases your profile, posts, comments, messages you sent, applications, connections and follows. Projects and organizations you own are handed to another admin, or archived if there is none. This can&apos;t be undone.
        </p>
        <ActionForm action={deleteAccountAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Type DELETE" name="confirm">
            <Input name="confirm" required autoComplete="off" />
          </Field>
          <Field label="Your password" name="currentPassword">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton variant="danger">Delete my account</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
