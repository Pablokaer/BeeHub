import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getOrganizationForManage } from "@/server/organizations";
import { archiveOrgAction } from "@/app/actions/teams";
import { ActionButton } from "@/components/ui/action-button";
import { Panel, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrgSettingsPage({ params }: PageProps<"/orgs/[slug]/manage/settings">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/orgs/${slug}/manage/settings`);
  const { org, role } = await orNotFound(getOrganizationForManage(viewer, decodeURIComponent(slug)));
  const archived = org.status === "ARCHIVED";
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <SectionTitle>Projects & opportunities</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/projects/new?org=${org.id}`} size="sm">
            New project for {org.name}
          </ButtonLink>
          <ButtonLink href={`/opportunities/new?owner=org:${org.id}`} size="sm" variant="secondary">
            Publish opportunity
          </ButtonLink>
        </div>
      </Panel>
      <Panel className="border-danger/30">
        <SectionTitle>{archived ? "Restore organization" : "Archive organization"}</SectionTitle>
        <p className="text-sm text-muted">
          {archived ? "Restoring makes the page visible again." : "Archiving hides the page from discovery and closes its open opportunities. Members, projects and history are kept."}
        </p>
        {role === "OWNER" ? (
          <div className="mt-3">
            <ActionButton action={archiveOrgAction} fields={{ organizationId: org.id, archived: archived ? "false" : "true" }} variant={archived ? "primary" : "danger"} confirm={archived ? undefined : "Yes, archive"}>
              {archived ? "Restore" : "Archive organization"}
            </ActionButton>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Only the owner can archive the organization.</p>
        )}
      </Panel>
    </div>
  );
}
