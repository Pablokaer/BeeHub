import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProjectForManage } from "@/server/projects";
import { listPublishIdentities } from "@/server/authz";
import { updateProjectAction } from "@/app/actions/teams";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Manage project" };

export default async function ManageProjectPage({ params }: PageProps<"/projects/[slug]/manage">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/projects/${slug}/manage`);
  const { project: p, role } = await orNotFound(getProjectForManage(viewer, decodeURIComponent(slug)));
  const { orgs } = await listPublishIdentities(viewer.id);
  const orgOptions = orgs.map((o) => ({ id: o.id, name: o.name }));
  if (p.organization && !orgOptions.some((o) => o.id === p.organization!.id)) orgOptions.push({ id: p.organization.id, name: p.organization.name });
  return (
    <ProjectForm
      action={updateProjectAction}
      orgs={orgOptions}
      submitLabel="Save changes"
      canChangeSlug={role === "OWNER"}
      values={{
        id: p.id,
        name: p.name,
        slug: p.slug,
        summary: p.summary,
        description: p.description,
        goals: p.goals,
        needs: p.needs,
        category: p.category,
        stage: p.stage,
        visibility: p.visibility,
        websiteUrl: p.websiteUrl,
        repoUrl: p.repoUrl,
        isOpenSource: p.isOpenSource,
        acceptsBeginners: p.acceptsBeginners,
        organizationId: p.organizationId,
        logoKey: p.logoKey,
        coverKey: p.coverKey,
        tech: p.tags.filter((t) => t.kind === "TECH").map((t) => t.tag.name),
        topics: p.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag.name),
      }}
    />
  );
}
