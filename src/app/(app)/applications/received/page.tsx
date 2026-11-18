import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Inbox } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listReceivedApplications, STATUS_FLOW } from "@/server/applications";
import { applicationStatusLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { safeUrl } from "@/lib/text";
import { startConversationAction } from "@/app/actions/social";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge, EmptyState, PageHeader, Tabs, TagList } from "@/components/ui/misc";
import { StatusTimeline, statusTone } from "@/components/application-status";
import { StatusControl } from "./status-control";

export const metadata: Metadata = { title: "Received applications" };

const STATUSES: ApplicationStatus[] = ["RECEIVED", "IN_REVIEW", "CONTACTED", "ACCEPTED", "REJECTED"];

export default async function ReceivedApplicationsPage({ searchParams }: PageProps<"/applications/received">) {
  const sp = await searchParams;
  const viewer = await requireViewerPage("/applications/received");
  const opportunityId = typeof sp.opportunity === "string" ? sp.opportunity : undefined;
  const status = STATUSES.find((s) => s === sp.status);
  const [all, apps] = await Promise.all([listReceivedApplications(viewer, { opportunityId }), listReceivedApplications(viewer, { opportunityId, status })]);
  const opportunities = [...new Map(all.map((a) => [a.opportunity.id, a.opportunity])).values()];
  const q = (s?: string) => {
    const p = new URLSearchParams();
    if (opportunityId) p.set("opportunity", opportunityId);
    if (s) p.set("status", s);
    const str = p.toString();
    return `/applications/received${str ? `?${str}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Applications" description="Review people and organizations who applied to your opportunities." />
      <Tabs label="Applications" items={[{ href: "/applications", label: "Sent" }, { href: "/applications/received", label: "Received", active: true, count: all.length }]} />
      {opportunities.length > 1 || opportunityId ? (
        <form action="/applications/received" className="mb-3 flex flex-wrap items-center gap-2">
          <label htmlFor="opp-filter" className="text-[13px] text-muted">
            Opportunity
          </label>
          <select id="opp-filter" name="opportunity" defaultValue={opportunityId ?? ""} className="h-8 max-w-xs rounded-md border border-line-strong bg-surface px-2 text-[13px]">
            <option value="">All opportunities</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <button type="submit" className="h-8 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] hover:bg-sunken">
            Filter
          </button>
        </form>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={q()} className={`rounded-full border px-2.5 py-1 text-[12px] ${!status ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}>
          All active ({all.length})
        </Link>
        {STATUSES.map((s) => {
          const n = all.filter((a) => a.status === s).length;
          return (
            <Link key={s} href={q(s)} className={`rounded-full border px-2.5 py-1 text-[12px] ${status === s ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}>
              {applicationStatusLabels[s]} ({n})
            </Link>
          );
        })}
      </div>
      {apps.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No applications here">
          When people apply to your opportunities, you&apos;ll review them here and move them through the process.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {apps.map((a) => {
            const name = a.applicant.profile?.displayName ?? a.applicant.username;
            const link = safeUrl(a.portfolioUrl);
            return (
              <li key={a.id} className="panel flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={name} imageKey={a.applicant.profile?.avatarKey} art={a.applicant.profile?.avatarArt} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${a.applicant.username}`} className="font-semibold hover:underline">
                      {name}
                    </Link>
                    {a.organization && (
                      <span className="text-sm text-muted">
                        {" "}
                        on behalf of{" "}
                        <Link href={`/o/${a.organization.slug}`} className="font-medium text-ink-2 hover:underline">
                          {a.organization.name}
                        </Link>
                      </span>
                    )}
                    {a.applicant.profile?.headline && <p className="text-[13px] text-ink-2">{a.applicant.profile.headline}</p>}
                    <p className="text-xs text-muted">
                      for{" "}
                      <Link href={`/opportunities/${a.opportunity.id}`} className="hover:underline">
                        {a.opportunity.title}
                      </Link>{" "}
                      · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                  <Badge tone={statusTone(a.status)}>{applicationStatusLabels[a.status]}</Badge>
                </div>
                {a.applicant.skills.length > 0 && <TagList tags={a.applicant.skills.map((s) => s.tag)} max={8} />}
                <p className="prose-plain rounded-md border border-line p-3 text-sm text-ink-2">{a.message}</p>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1 text-[13px]">
                    <ExternalLink className="size-3.5" aria-hidden /> {new URL(link).hostname}
                  </a>
                )}
                <StatusTimeline events={a.events} />
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton action={startConversationAction} fields={{ userId: a.applicant.id }}>
                    Message {name.split(" ")[0]}
                  </ActionButton>
                </div>
                <StatusControl applicationId={a.id} next={STATUS_FLOW[a.status]} hasProject={!!a.opportunity.projectId} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
