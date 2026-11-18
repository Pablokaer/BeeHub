import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, MapPin, Users } from "lucide-react";
import type { OrgCardData, ProjectCardData } from "@/server/selects";
import { availabilityLabels, orgSizeLabels, orgTypeLabels, projectCategoryLabels, projectStageLabels } from "@/lib/constants";
import type { Availability } from "@/generated/prisma/enums";
import { Avatar, EntityLogo } from "./ui/avatar";
import { Badge, TagList } from "./ui/misc";

type Person = {
  id: string;
  username: string;
  profile: { displayName: string; headline: string | null; avatarKey: string | null; avatarArt?: string | null; location: string | null; showLocation: boolean; availability: Availability[] } | null;
  skills?: { tag: { slug: string; name: string } }[];
};

export function PersonCard({ user, actions, note, compact }: { user: Person; actions?: ReactNode; note?: ReactNode; compact?: boolean }) {
  const name = user.profile?.displayName ?? user.username;
  const available = user.profile?.availability.filter((a) => a !== "UNAVAILABLE") ?? [];
  return (
    <article className={compact ? "flex items-center gap-3 py-2" : "panel flex gap-4 p-5"}>
      <Link href={`/u/${user.username}`} tabIndex={-1} aria-hidden>
        <Avatar name={name} imageKey={user.profile?.avatarKey} art={user.profile?.avatarArt} size={compact ? "sm" : "md"} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${user.username}`} className="block truncate text-sm font-semibold hover:underline">
          {name}
        </Link>
        {user.profile?.headline && <p className="line-clamp-2 text-[13px] text-ink-2">{user.profile.headline}</p>}
        {!compact && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {user.profile?.showLocation && user.profile.location && (
              <Badge>
                <MapPin className="size-3" aria-hidden /> {user.profile.location}
              </Badge>
            )}
            {available.slice(0, 2).map((a) => (
              <Badge key={a} tone="accent">
                {availabilityLabels[a]}
              </Badge>
            ))}
          </div>
        )}
        {!compact && user.skills && user.skills.length > 0 && <TagList tags={user.skills.map((s) => s.tag)} max={5} className="mt-2" />}
        {note && <div className="mt-1 text-xs text-muted">{note}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">{actions}</div>}
    </article>
  );
}

export function ProjectCard({ project: p, footer }: { project: ProjectCardData & { opportunities?: { id: string; title: string }[] }; footer?: ReactNode }) {
  const tech = p.tags.filter((t) => t.kind === "TECH").map((t) => t.tag);
  const topics = p.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag);
  return (
    <article className="panel flex flex-col p-5 transition-colors hover:border-line-strong">
      <div className="flex gap-3">
        <EntityLogo name={p.name} imageKey={p.logoKey} kind="project" size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Link href={`/p/${p.slug}`} className="truncate hover:underline">
              {p.name}
            </Link>
            {p.visibility === "PRIVATE" && <Lock className="size-3.5 text-muted" aria-label="Private" />}
          </h3>
          <p className="text-[13px] text-muted">
            {projectCategoryLabels[p.category]}
            {p.organization && (
              <>
                {" · "}
                <Link href={`/o/${p.organization.slug}`} className="hover:text-ink hover:underline">
                  {p.organization.name}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink-2">{p.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone="accent">{projectStageLabels[p.stage]}</Badge>
        {p.isOpenSource && <Badge>Open source</Badge>}
        {p.acceptsBeginners && <Badge>Beginner-friendly</Badge>}
        <Badge>
          <Users className="size-3" aria-hidden /> {p._count.members}
        </Badge>
        {p._count.opportunities > 0 && <Badge tone="signal">{p._count.opportunities} open {p._count.opportunities === 1 ? "role" : "roles"}</Badge>}
      </div>
      {(tech.length > 0 || topics.length > 0) && <TagList tags={[...tech, ...topics]} max={6} className="mt-2.5" />}
      {p.opportunities && p.opportunities.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-2.5">
          {p.opportunities.map((o) => (
            <li key={o.id} className="truncate text-[13px]">
              <span className="text-signal">Looking for </span>
              <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-3 border-t border-line pt-3">{footer}</div>}
    </article>
  );
}

export function OrgCard({ org: o }: { org: OrgCardData }) {
  return (
    <article className="panel flex gap-4 p-5 transition-colors hover:border-line-strong">
      <EntityLogo name={o.name} imageKey={o.logoKey} kind="org" size="md" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold">
          <Link href={`/o/${o.slug}`} className="hover:underline">
            {o.name}
          </Link>
        </h3>
        <p className="text-[13px] text-muted">
          {orgTypeLabels[o.type]}
          {o.industry ? ` · ${o.industry}` : ""}
          {o.location ? ` · ${o.location}` : ""}
        </p>
        {o.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{o.tagline}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {o.size && <Badge>{orgSizeLabels[o.size]} people</Badge>}
          <Badge>{o._count.projects} projects</Badge>
          <Badge>{o._count.members} members</Badge>
        </div>
        {o.tags.length > 0 && <TagList tags={o.tags.map((t) => t.tag)} max={5} className="mt-2" />}
      </div>
    </article>
  );
}
