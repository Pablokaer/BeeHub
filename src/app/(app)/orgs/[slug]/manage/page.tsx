import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getOrganizationForManage } from "@/server/organizations";
import { updateOrganizationAction } from "@/app/actions/teams";
import { OrgForm } from "../../org-form";

export const metadata: Metadata = { title: "Manage organization" };

export default async function ManageOrgPage({ params }: PageProps<"/orgs/[slug]/manage">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/orgs/${slug}/manage`);
  const { org, role } = await orNotFound(getOrganizationForManage(viewer, decodeURIComponent(slug)));
  return (
    <OrgForm
      action={updateOrganizationAction}
      submitLabel="Save changes"
      canChangeSlug={role === "OWNER"}
      values={{ id: org.id, name: org.name, slug: org.slug, type: org.type, tagline: org.tagline, description: org.description, industry: org.industry, website: org.website, location: org.location, size: org.size, logoKey: org.logoKey, coverKey: org.coverKey, tags: org.tags.map((t) => t.tag.name) }}
    />
  );
}
