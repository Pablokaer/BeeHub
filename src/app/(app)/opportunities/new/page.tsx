import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/viewer";
import { listPublishIdentities } from "@/server/authz";
import { createOpportunityAction } from "@/app/actions/opportunities";
import { PageHeader } from "@/components/ui/misc";
import { FormAlert } from "@/components/ui/form";
import { OpportunityForm } from "../opportunity-form";

export const metadata: Metadata = { title: "Publish an opportunity" };

export default async function NewOpportunityPage({ searchParams }: PageProps<"/opportunities/new">) {
  const { owner } = await searchParams;
  const viewer = await requireViewerPage("/opportunities/new");
  const ids = await listPublishIdentities(viewer.id);
  const owners = [
    ...ids.projects.map((p) => ({ value: `project:${p.id}`, label: `Project · ${p.name}` })),
    ...ids.orgs.map((o) => ({ value: `org:${o.id}`, label: `Organization · ${o.name}` })),
    { value: "user", label: `Me · ${viewer.displayName}` },
  ];
  const preselected = typeof owner === "string" && owners.some((o) => o.value === owner) ? owner : owners[0].value;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Publish an opportunity" description="Tell people what you're looking for. Matching members are notified, and you can review applications as they arrive." />
      {!viewer.emailVerified && <FormAlert kind="info">Confirm your email address before publishing.</FormAlert>}
      <OpportunityForm
        action={createOpportunityAction}
        owners={owners}
        values={{ owner: preselected, title: "", description: "", category: "ENGINEERING", collaborationType: "VOLUNTEER", workMode: "REMOTE", location: null, experienceLevel: null, duration: null, commitment: null, compensationType: "NONE", compensation: null, deadline: "", skills: [], topics: [] }}
      />
    </div>
  );
}
