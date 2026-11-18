import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/viewer";
import { listPublishIdentities } from "@/server/authz";
import { PageHeader } from "@/components/ui/misc";
import { FormAlert } from "@/components/ui/form";
import { createProjectAction } from "@/app/actions/teams";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { org } = await searchParams;
  const viewer = await requireViewerPage("/projects/new");
  const { orgs } = await listPublishIdentities(viewer.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create a project" description="Present your project, what stage it's at and what it needs. You'll be its owner and can invite a team." />
      {!viewer.emailVerified && <FormAlert kind="info">Confirm your email address before creating a project.</FormAlert>}
      <ProjectForm
        action={createProjectAction}
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        submitLabel="Create project"
        values={
          typeof org === "string" && orgs.some((o) => o.id === org)
            ? { name: "", slug: "", summary: "", description: null, goals: null, needs: null, category: "WEB", stage: "IDEA", visibility: "PUBLIC", websiteUrl: null, repoUrl: null, isOpenSource: false, acceptsBeginners: false, organizationId: org, logoKey: null, coverKey: null, tech: [], topics: [] }
            : undefined
        }
      />
    </div>
  );
}
