import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/viewer";
import { createOrganizationAction } from "@/app/actions/teams";
import { PageHeader } from "@/components/ui/misc";
import { FormAlert } from "@/components/ui/form";
import { OrgForm } from "../org-form";

export const metadata: Metadata = { title: "New organization" };

export default async function NewOrgPage() {
  const viewer = await requireViewerPage("/orgs/new");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create an organization" description="Companies, startups, associations and communities get their own page, members with roles, projects and opportunities." />
      {!viewer.emailVerified && <FormAlert kind="info">Confirm your email address before creating an organization.</FormAlert>}
      <OrgForm action={createOrganizationAction} submitLabel="Create organization" />
    </div>
  );
}
