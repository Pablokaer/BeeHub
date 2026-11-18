import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProjectForManage } from "@/server/projects";
import { archiveProjectAction } from "@/app/actions/teams";
import { ActionButton } from "@/components/ui/action-button";
import { Panel, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[slug]/manage/settings">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/projects/${slug}/manage/settings`);
  const { project: p, role } = await orNotFound(getProjectForManage(viewer, decodeURIComponent(slug)));
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <SectionTitle>Opportunities & applications</SectionTitle>
        <p className="text-sm text-muted">Manage roles you&apos;ve published and review applicants.</p>
        <div className="mt-3 flex gap-2">
          <ButtonLink href={`/opportunities/new?owner=project:${p.id}`} size="sm">
            Publish opportunity
          </ButtonLink>
          <ButtonLink href="/opportunities/manage" size="sm" variant="secondary">
            My opportunities
          </ButtonLink>
          <ButtonLink href="/applications/received" size="sm" variant="secondary">
            Received applications
          </ButtonLink>
        </div>
      </Panel>
      <Panel className="border-danger/30">
        <SectionTitle>{p.status === "ARCHIVED" ? "Restore project" : "Archive project"}</SectionTitle>
        <p className="text-sm text-muted">
          {p.status === "ARCHIVED"
            ? "Restoring makes the project visible again (if public). Closed opportunities stay closed until you reopen them."
            : "Archiving hides the project from discovery and closes its open opportunities. Its history, team and applications are kept."}
        </p>
        {role === "OWNER" ? (
          <div className="mt-3">
            <ActionButton action={archiveProjectAction} fields={{ projectId: p.id, archived: p.status === "ARCHIVED" ? "false" : "true" }} variant={p.status === "ARCHIVED" ? "primary" : "danger"} confirm={p.status === "ARCHIVED" ? undefined : "Yes, archive"}>
              {p.status === "ARCHIVED" ? "Restore project" : "Archive project"}
            </ActionButton>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Only the owner can archive the project.</p>
        )}
      </Panel>
    </div>
  );
}
