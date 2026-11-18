import type { Metadata } from "next";
import Link from "next/link";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProjectForManage, suggestComplementaryProjects } from "@/server/projects";
import { partnershipsFor } from "@/server/partnerships";
import { hasRank } from "@/server/authz";
import { PartnershipManager } from "@/components/partnership-manager";
import { EntityLogo } from "@/components/ui/avatar";
import { Panel, SectionTitle } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Partners" };

export default async function ProjectPartnersPage({ params }: PageProps<"/projects/[slug]/manage/partners">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/projects/${slug}/manage/partners`);
  const { project: p, role } = await orNotFound(getProjectForManage(viewer, decodeURIComponent(slug)));
  const [rows, suggestions] = await Promise.all([partnershipsFor({ projectId: p.id }, ["PENDING", "ACTIVE"]), suggestComplementaryProjects(p.id)]);
  return (
    <div className="flex flex-col gap-4">
      <PartnershipManager rows={rows} canManage={hasRank(role, "ADMIN")} />
      <Panel>
        <SectionTitle>Complementary projects</SectionTitle>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted">Publish open opportunities with required skills, and we&apos;ll suggest projects whose technologies or team cover them.</p>
        ) : (
          <ul className="divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.project.id} className="flex items-center gap-3 py-3">
                <EntityLogo name={s.project.name} imageKey={s.project.logoKey} kind="project" size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${s.project.slug}`} className="text-sm font-medium hover:underline">
                    {s.project.name}
                  </Link>
                  <p className="text-xs text-muted">Covers: {s.covers.join(", ")}</p>
                </div>
                <Link href={`/p/${s.project.slug}`} className="link text-[13px]">
                  View & propose
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
