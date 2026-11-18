import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Briefcase } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listManagedOpportunities } from "@/server/opportunities";
import { opportunityStatusLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { setOpportunityStatusAction } from "@/app/actions/opportunities";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ownerOf } from "@/components/opportunity-card";
import type { OpportunityStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "My opportunities" };

const FILTERS = ["ALL", "OPEN", "DRAFT", "CLOSED", "FILLED", "ARCHIVED"] as const;

export default async function ManageOpportunitiesPage({ searchParams }: PageProps<"/opportunities/manage">) {
  const sp = await searchParams;
  const viewer = await requireViewerPage("/opportunities/manage");
  const status = (FILTERS.find((f) => f === sp.status) ?? "ALL") as OpportunityStatus | "ALL";
  const items = await listManagedOpportunities(viewer, { status });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My opportunities"
        description="Everything you publish personally or for projects and organizations you manage."
        actions={
          <ButtonLink href="/opportunities/new" size="sm">
            <Plus className="size-4" aria-hidden /> New
          </ButtonLink>
        }
      />
      <Tabs label="Status" items={FILTERS.map((f) => ({ href: f === "ALL" ? "/opportunities/manage" : `/opportunities/manage?status=${f}`, label: f === "ALL" ? "All" : opportunityStatusLabels[f], active: status === f }))} />
      {items.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="Nothing here yet" action={<ButtonLink href="/opportunities/new" size="sm">Publish an opportunity</ButtonLink>}>
          Opportunities let you describe what your project or organization needs and receive applications.
        </EmptyState>
      ) : (
        <ul className="panel divide-y divide-line">
          {items.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
                <p className="text-xs text-muted">
                  {ownerOf(o).name} · updated {timeAgo(o.publishedAt ?? o.createdAt)}
                </p>
              </div>
              <Badge tone={o.status === "OPEN" ? "success" : o.status === "DRAFT" ? "warn" : "neutral"}>{opportunityStatusLabels[o.status]}</Badge>
              <Link href={`/applications/received?opportunity=${o.id}`} className="link text-[13px]">
                {o._count.applications} application{o._count.applications === 1 ? "" : "s"}
              </Link>
              {o.status === "OPEN" ? (
                <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "CLOSED" }}>
                  Close
                </ActionButton>
              ) : o.status !== "ARCHIVED" && o.status !== "REMOVED" ? (
                <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "OPEN" }}>
                  {o.status === "DRAFT" ? "Publish" : "Reopen"}
                </ActionButton>
              ) : null}
              <ButtonLink href={`/opportunities/${o.id}/edit`} size="sm" variant="ghost">
                Edit
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
