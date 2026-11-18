import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getOpportunityForEdit } from "@/server/opportunities";
import { updateOpportunityAction } from "@/app/actions/opportunities";
import { toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { OpportunityForm } from "../../opportunity-form";

export const metadata: Metadata = { title: "Edit opportunity" };

export default async function EditOpportunityPage({ params }: PageProps<"/opportunities/[id]/edit">) {
  const { id } = await params;
  const viewer = await requireViewerPage(`/opportunities/${id}/edit`);
  const o = await orNotFound(getOpportunityForEdit(viewer, id));
  const owner = o.projectId ? `project:${o.projectId}` : o.organizationId ? `org:${o.organizationId}` : "user";
  const ownerLabel = o.project ? `Project · ${o.project.name}` : o.organization ? `Organization · ${o.organization.name}` : `Me · ${viewer.displayName}`;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit opportunity" />
      <OpportunityForm
        action={updateOpportunityAction}
        owners={[{ value: owner, label: ownerLabel }]}
        values={{
          id: o.id,
          owner,
          title: o.title,
          description: o.description,
          category: o.category,
          collaborationType: o.collaborationType,
          workMode: o.workMode,
          location: o.location,
          experienceLevel: o.experienceLevel,
          duration: o.duration,
          commitment: o.commitment,
          compensationType: o.compensationType,
          compensation: o.compensation,
          deadline: toDateInput(o.deadline),
          skills: o.tags.filter((t) => t.kind === "SKILL").map((t) => t.tag.name),
          topics: o.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag.name),
          status: o.status,
        }}
      />
    </div>
  );
}
