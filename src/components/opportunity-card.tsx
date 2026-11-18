import Link from "next/link";
import { CalendarClock, MapPin, Users } from "lucide-react";
import type { OpportunityCardData } from "@/server/selects";
import type { MatchResult } from "@/lib/matching-engine";
import { collaborationLabels, experienceLabels, opportunityStatusLabels, workModeLabels } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { Avatar, EntityLogo } from "./ui/avatar";
import { Badge, TagList } from "./ui/misc";
import { MatchBadge } from "./match";
import { findPosition } from "@/lib/positions";

type Opp = Pick<OpportunityCardData, "id" | "title" | "collaborationType" | "workMode" | "location" | "isPaid" | "status" | "publishedAt" | "createdAt" | "project" | "organization" | "createdBy"> &
  Partial<Pick<OpportunityCardData, "tags" | "experienceLevel" | "deadline" | "_count" | "compensation" | "position">>;

type EntityRef = { name: string; slug: string; logoKey: string | null } | null;
type OwnerRef = {
  project: EntityRef;
  organization: EntityRef;
  createdBy: { username: string; profile: { displayName: string; avatarKey: string | null; avatarArt?: string | null } | null } | null;
};

export function ownerOf(o: OwnerRef) {
  if (o.project) return { name: o.project.name, href: `/p/${o.project.slug}`, logo: <EntityLogo name={o.project.name} imageKey={o.project.logoKey} kind="project" size="md" /> };
  if (o.organization) return { name: o.organization.name, href: `/o/${o.organization.slug}`, logo: <EntityLogo name={o.organization.name} imageKey={o.organization.logoKey} kind="org" size="md" /> };
  const name = o.createdBy?.profile?.displayName ?? "A member";
  return { name, href: o.createdBy ? `/u/${o.createdBy.username}` : "#", logo: <Avatar name={name} imageKey={o.createdBy?.profile?.avatarKey} art={o.createdBy?.profile?.avatarArt} size="md" /> };
}

/** Compact one-line row used in sidebars and the landing page. */
export function OpportunityRow({ opportunity: o }: { opportunity: Opp }) {
  const owner = ownerOf(o);
  return (
    <Link href={`/opportunities/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
      {owner.logo}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{o.title}</span>
        <span className="block truncate text-xs text-muted">
          {owner.name} · {collaborationLabels[o.collaborationType]} · {workModeLabels[o.workMode]}
        </span>
      </span>
      {o.isPaid && <Badge tone="success">Paid</Badge>}
    </Link>
  );
}

/** Full card for listings and search results. */
export function OpportunityCard({ opportunity: o, match, showStatus }: { opportunity: Opp & { description?: string }; match?: MatchResult | null; showStatus?: boolean }) {
  const owner = ownerOf(o);
  const skills = (o.tags ?? []).filter((t) => t.kind === "SKILL").map((t) => t.tag);
  return (
    <article className="panel flex gap-3 p-4 transition-colors hover:border-line-strong">
      <Link href={owner.href} className="shrink-0" tabIndex={-1} aria-hidden>
        {owner.logo}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="eyebrow !normal-case !tracking-normal text-signal">
              Looking for
              {findPosition(o.position) && (
                <>
                  {" · "}
                  <Link href={`/opportunities?position=${o.position}`} className="font-semibold underline underline-offset-2 hover:text-ink" title="See all opportunities for this position">
                    {findPosition(o.position)!.label}
                  </Link>
                </>
              )}
            </p>
            <h3 className="text-[15px] font-semibold leading-snug">
              <Link href={`/opportunities/${o.id}`} className="hover:underline">
                {o.title}
              </Link>
            </h3>
            <p className="text-[13px] text-muted">
              <Link href={owner.href} className="hover:text-ink hover:underline">
                {owner.name}
              </Link>{" "}
              · {timeAgo(o.publishedAt ?? o.createdAt)}
            </p>
          </div>
          {match && <MatchBadge score={match.score} />}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {showStatus && o.status !== "OPEN" && <Badge tone="warn">{opportunityStatusLabels[o.status]}</Badge>}
          <Badge tone="signal">{collaborationLabels[o.collaborationType]}</Badge>
          <Badge>
            <MapPin className="size-3" aria-hidden />
            {workModeLabels[o.workMode]}
            {o.location ? ` · ${o.location}` : ""}
          </Badge>
          {o.experienceLevel && <Badge>{experienceLabels[o.experienceLevel]}</Badge>}
          {o.isPaid ? <Badge tone="success">Paid{o.compensation ? ` · ${o.compensation}` : ""}</Badge> : <Badge>Unpaid</Badge>}
          {o.deadline && (
            <Badge>
              <CalendarClock className="size-3" aria-hidden /> Apply by {formatDate(o.deadline)}
            </Badge>
          )}
          {o._count && o._count.applications > 0 && (
            <Badge>
              <Users className="size-3" aria-hidden /> {o._count.applications}
            </Badge>
          )}
        </div>
        {o.description && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{o.description}</p>}
        {skills.length > 0 && <TagList tags={skills} max={6} className="mt-2.5" />}
        {match && match.reasons.filter((r) => r.positive).length > 0 && (
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-ink-2">Why: </span>
            {match.reasons
              .filter((r) => r.positive)
              .slice(0, 2)
              .map((r) => r.text)
              .join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}
