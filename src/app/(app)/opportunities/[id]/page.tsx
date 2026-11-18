import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, Pencil, Users } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { getOpportunity } from "@/server/opportunities";
import { recommendCandidates } from "@/server/matching";
import { listPublishIdentities } from "@/server/authz";
import { canMessage } from "@/server/messaging";
import {
  applicationStatusLabels, collaborationLabels, commitmentLabels, compensationLabels, durationLabels, experienceLabels, opportunityCategoryLabels,
  opportunityStatusLabels, workModeLabels,
} from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { setOpportunityStatusAction, withdrawApplicationAction } from "@/app/actions/opportunities";
import { startConversationAction } from "@/app/actions/social";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge, KeyValue, Panel, SectionTitle, Skeleton, TagList } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { MatchBadge, MatchExplainer } from "@/components/match";
import { ownerOf } from "@/components/opportunity-card";
import { ReportButton } from "@/components/report-dialog";
import { ApplyForm } from "./apply-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Opportunity" };
}

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  const data = await getOpportunity(viewer, id);
  if (!data) notFound();
  const { opportunity: o, canManage, accepting, myApplication, match } = data;
  const owner = ownerOf(o);
  const skills = o.tags.filter((t) => t.kind === "SKILL").map((t) => t.tag);
  const topics = o.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag);
  const orgs = viewer && !canManage ? (await listPublishIdentities(viewer.id)).orgs : [];
  const creatorMessage = viewer && o.createdBy && !canManage && o.createdBy.id !== viewer.id ? (await canMessage(viewer.id, o.createdBy.id)).allowed : false;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article className="flex min-w-0 flex-col gap-4">
        <section className="panel p-5">
          <Link href={owner.href} className="inline-flex items-center gap-2.5 text-sm font-medium hover:underline">
            {owner.logo}
            {owner.name}
          </Link>
          <p className="eyebrow mt-4 !normal-case !tracking-normal text-signal">Looking for</p>
          <h1 className="text-2xl font-semibold leading-tight">{o.title}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {o.status !== "OPEN" && <Badge tone="warn">{opportunityStatusLabels[o.status]}</Badge>}
            <Badge tone="signal">{collaborationLabels[o.collaborationType]}</Badge>
            <Badge>{opportunityCategoryLabels[o.category]}</Badge>
            <Badge>{workModeLabels[o.workMode]}{o.location ? ` · ${o.location}` : ""}</Badge>
            {o.isPaid ? <Badge tone="success">Paid</Badge> : <Badge>Unpaid</Badge>}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Published {timeAgo(o.publishedAt ?? o.createdAt)}
            {o.deadline && (
              <>
                {" · "}
                <CalendarClock className="inline size-3.5 align-[-2px]" aria-hidden /> Apply by {formatDate(o.deadline)}
              </>
            )}
          </p>
        </section>
        <Panel>
          <SectionTitle>Description</SectionTitle>
          <RichText text={o.description} className="text-sm leading-relaxed text-ink-2" />
        </Panel>
        <Panel>
          <SectionTitle>Details</SectionTitle>
          <KeyValue
            items={[
              { label: "Collaboration", value: collaborationLabels[o.collaborationType] },
              { label: "Work mode", value: workModeLabels[o.workMode] },
              { label: "Location", value: o.location },
              { label: "Experience", value: o.experienceLevel ? experienceLabels[o.experienceLevel] : "Any level" },
              { label: "Duration", value: o.duration ? durationLabels[o.duration] : null },
              { label: "Availability", value: o.commitment ? commitmentLabels[o.commitment] : null },
              { label: "Compensation", value: `${compensationLabels[o.compensationType]}${o.compensation ? ` · ${o.compensation}` : ""}` },
            ]}
          />
          {skills.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold">Skills wanted</h3>
              <TagList tags={skills} max={15} />
            </>
          )}
          {topics.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold">Topics</h3>
              <TagList tags={topics} max={10} />
            </>
          )}
        </Panel>
        {o.project && (
          <Panel>
            <SectionTitle>About {o.project.name}</SectionTitle>
            <p className="text-sm text-ink-2">{o.project.summary}</p>
            <Link href={`/p/${o.project.slug}`} className="link mt-2 inline-block text-sm">
              View project
            </Link>
          </Panel>
        )}
        {viewer && !canManage && (
          <div>
            <ReportButton targetType="OPPORTUNITY" targetId={o.id} label="Report this opportunity" />
          </div>
        )}
      </article>

      <aside className="flex flex-col gap-4">
        {canManage ? (
          <>
            <Panel>
              <SectionTitle>Manage</SectionTitle>
              <p className="flex items-center gap-1.5 text-sm">
                <Users className="size-4 text-muted" aria-hidden /> {o._count.applications} application{o._count.applications === 1 ? "" : "s"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={`/applications/received?opportunity=${o.id}`} size="sm">
                  Review applications
                </ButtonLink>
                <ButtonLink href={`/opportunities/${o.id}/edit`} size="sm" variant="secondary">
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </ButtonLink>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {(o.status === "DRAFT" || o.status === "CLOSED" || o.status === "FILLED") && (
                  <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "OPEN" }} variant="primary">
                    {o.status === "DRAFT" ? "Publish" : "Reopen"}
                  </ActionButton>
                )}
                {o.status === "OPEN" && (
                  <>
                    <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "CLOSED" }}>
                      Close applications
                    </ActionButton>
                    <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "FILLED" }}>
                      Mark filled
                    </ActionButton>
                  </>
                )}
                {o.status !== "ARCHIVED" && (
                  <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "ARCHIVED" }} variant="ghost" confirm="Archive?">
                    Archive
                  </ActionButton>
                )}
                {o.status === "ARCHIVED" && (
                  <ActionButton action={setOpportunityStatusAction} fields={{ opportunityId: o.id, status: "CLOSED" }}>
                    Unarchive
                  </ActionButton>
                )}
              </div>
            </Panel>
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <Candidates opportunityId={o.id} />
            </Suspense>
          </>
        ) : (
          <Panel>
            {!viewer ? (
              <>
                <SectionTitle>Interested?</SectionTitle>
                <p className="text-sm text-muted">Sign in to apply and see how well this matches your profile.</p>
                <ButtonLink href={`/login?next=/opportunities/${o.id}`} className="mt-3 w-full">
                  Sign in to apply
                </ButtonLink>
              </>
            ) : myApplication && myApplication.status !== "WITHDRAWN" ? (
              <>
                <SectionTitle>Your application</SectionTitle>
                <p className="text-sm">
                  Status: <Badge tone={myApplication.status === "ACCEPTED" ? "success" : myApplication.status === "REJECTED" ? "danger" : "accent"}>{applicationStatusLabels[myApplication.status]}</Badge>
                </p>
                <p className="mt-1 text-xs text-muted">Sent {timeAgo(myApplication.createdAt)}</p>
                <div className="mt-3 flex gap-2">
                  <ButtonLink href="/applications" size="sm" variant="secondary">
                    Track applications
                  </ButtonLink>
                  {["RECEIVED", "IN_REVIEW", "CONTACTED"].includes(myApplication.status) && (
                    <ActionButton action={withdrawApplicationAction} fields={{ applicationId: myApplication.id }} variant="ghost" confirm="Withdraw?">
                      Withdraw
                    </ActionButton>
                  )}
                </div>
              </>
            ) : !accepting ? (
              <>
                <SectionTitle>Applications closed</SectionTitle>
                <p className="text-sm text-muted">This opportunity is no longer accepting applications.</p>
              </>
            ) : !viewer.emailVerified ? (
              <>
                <SectionTitle>Apply</SectionTitle>
                <p className="text-sm text-muted">Confirm your email address to apply.</p>
              </>
            ) : (
              <>
                <SectionTitle>Apply</SectionTitle>
                <ApplyForm opportunityId={o.id} orgs={orgs.map((x) => ({ id: x.id, name: x.name }))} />
              </>
            )}
            {creatorMessage && o.createdBy && (
              <div className="mt-4 border-t border-line pt-3">
                <ActionButton action={startConversationAction} fields={{ userId: o.createdBy.id }}>
                  Message {o.createdBy.profile?.displayName}
                </ActionButton>
              </div>
            )}
          </Panel>
        )}
        {match && <MatchExplainer match={match} />}
      </aside>
    </div>
  );
}

async function Candidates({ opportunityId }: { opportunityId: string }) {
  const people = await recommendCandidates(opportunityId, [], 6);
  return (
    <Panel>
      <SectionTitle>Suggested people</SectionTitle>
      {people.length === 0 ? (
        <p className="text-[13px] text-muted">No strong matches yet. Members whose skills fit will appear here as they join.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {people.map(({ user, match }) => {
            const name = user.profile?.displayName ?? user.username;
            return (
              <li key={user.id} className="flex items-start gap-2.5">
                <Avatar name={name} imageKey={user.profile?.avatarKey} art={user.profile?.avatarArt} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/u/${user.username}`} className="truncate text-sm font-medium hover:underline">
                      {name}
                    </Link>
                    <MatchBadge score={match.score} />
                  </div>
                  <p className="text-xs text-muted">{match.reasons.filter((r) => r.positive).slice(0, 2).map((r) => r.text).join(" · ")}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
