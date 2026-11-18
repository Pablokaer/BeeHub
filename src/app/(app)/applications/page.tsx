import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listSentApplications } from "@/server/applications";
import { applicationStatusLabels, collaborationLabels } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { withdrawApplicationAction } from "@/app/actions/opportunities";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ownerOf } from "@/components/opportunity-card";
import { StatusTimeline, statusTone } from "@/components/application-status";

export const metadata: Metadata = { title: "My applications" };

export default async function SentApplicationsPage() {
  const viewer = await requireViewerPage("/applications");
  const apps = await listSentApplications(viewer);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Applications" description="Follow the status of everything you've applied to." />
      <Tabs label="Applications" items={[{ href: "/applications", label: "Sent", active: true, count: apps.length }, { href: "/applications/received", label: "Received" }]} />
      {apps.length === 0 ? (
        <EmptyState icon={<Inbox />} title="You haven't applied to anything yet" action={<ButtonLink href="/opportunities?sort=match" size="sm">Find opportunities</ButtonLink>}>
          Browse opportunities that match your skills and send your first application.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {apps.map((a) => {
            const owner = ownerOf(a.opportunity);
            return (
              <li key={a.id} className="panel flex flex-col gap-3 p-4 sm:flex-row">
                <div className="shrink-0">{owner.logo}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/opportunities/${a.opportunity.id}`} className="font-medium hover:underline">
                        {a.opportunity.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {owner.name} · {collaborationLabels[a.opportunity.collaborationType]} · applied {formatDate(a.createdAt)}
                        {a.organization && ` · as ${a.organization.name}`}
                      </p>
                    </div>
                    <Badge tone={statusTone(a.status)}>{applicationStatusLabels[a.status]}</Badge>
                  </div>
                  <StatusTimeline events={a.events} />
                  <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">{a.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>Updated {timeAgo(a.updatedAt)}</span>
                    {["RECEIVED", "IN_REVIEW", "CONTACTED"].includes(a.status) && (
                      <ActionButton action={withdrawApplicationAction} fields={{ applicationId: a.id }} variant="ghost" confirm="Withdraw?">
                        Withdraw
                      </ActionButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
