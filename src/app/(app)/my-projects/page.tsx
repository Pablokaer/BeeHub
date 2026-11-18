import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, Plus } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listMyProjects } from "@/server/projects";
import { listMyOrganizations } from "@/server/organizations";
import { memberRoleLabels, orgTypeLabels } from "@/lib/constants";
import { EntityLogo } from "@/components/ui/avatar";
import { ProjectCard } from "@/components/entity-cards";
import { Badge, EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My projects" };

export default async function MyProjectsPage() {
  const viewer = await requireViewerPage("/my-projects");
  const [{ memberships, followed }, orgs] = await Promise.all([listMyProjects(viewer), listMyOrganizations(viewer)]);
  return (
    <div>
      <PageHeader
        title="My projects & organizations"
        actions={
          <>
            <ButtonLink href="/orgs/new" variant="secondary" size="sm">
              New organization
            </ButtonLink>
            <ButtonLink href="/projects/new" size="sm">
              <Plus className="size-4" aria-hidden /> New project
            </ButtonLink>
          </>
        }
      />
      <section className="mb-8">
        <SectionTitle>Projects I&apos;m part of</SectionTitle>
        {memberships.length === 0 ? (
          <EmptyState icon={<FolderGit2 />} title="No projects yet" action={<ButtonLink href="/projects/new" size="sm">Create a project</ButtonLink>}>
            Create a project to present your idea and recruit collaborators, or apply to join someone else&apos;s.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {memberships.map((m) => (
              <ProjectCard
                key={m.project.id}
                project={m.project}
                footer={
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted">
                      {m.title ? `${m.title} · ` : ""}
                      {memberRoleLabels[m.role]}
                      {m.project.status === "ARCHIVED" && " · Archived"}
                    </span>
                    {m.role !== "MEMBER" && (
                      <Link href={`/projects/${m.project.slug}/manage`} className="link">
                        Manage
                      </Link>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
      <section className="mb-8">
        <SectionTitle>Organizations</SectionTitle>
        {orgs.length === 0 ? (
          <p className="text-sm text-muted">
            You&apos;re not part of any organization. <Link href="/orgs/new" className="link">Create one</Link> for your company, startup or community.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {orgs.map((m) => (
              <li key={m.organization.id} className="panel flex items-center gap-3 p-4">
                <EntityLogo name={m.organization.name} imageKey={m.organization.logoKey} kind="org" />
                <div className="min-w-0 flex-1">
                  <Link href={`/o/${m.organization.slug}`} className="block truncate font-medium hover:underline">
                    {m.organization.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {orgTypeLabels[m.organization.type]} · {memberRoleLabels[m.role]}
                  </p>
                </div>
                {m.organization.status === "ARCHIVED" && <Badge tone="warn">Archived</Badge>}
                {m.role !== "MEMBER" && (
                  <Link href={`/orgs/${m.organization.slug}/manage`} className="link text-[13px]">
                    Manage
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {followed.length > 0 && (
        <section>
          <SectionTitle>Projects I follow</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {followed.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
