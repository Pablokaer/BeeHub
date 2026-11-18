import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getOrganizationForManage } from "@/server/organizations";
import { partnershipsFor } from "@/server/partnerships";
import { hasRank } from "@/server/authz";
import { PartnershipManager } from "@/components/partnership-manager";

export const metadata: Metadata = { title: "Partners" };

export default async function OrgPartnersPage({ params }: PageProps<"/orgs/[slug]/manage/partners">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/orgs/${slug}/manage/partners`);
  const { org, role } = await orNotFound(getOrganizationForManage(viewer, decodeURIComponent(slug)));
  const rows = await partnershipsFor({ organizationId: org.id }, ["PENDING", "ACTIVE"]);
  return <PartnershipManager rows={rows} canManage={hasRank(role, "ADMIN")} />;
}
