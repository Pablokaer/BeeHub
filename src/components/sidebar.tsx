import Link from "next/link";
import { connection } from "next/server";
import type { Viewer } from "@/server/auth/types";
import { Pencil } from "lucide-react";
import { getOwnProfileCard } from "@/server/profiles";
import { recommendOpportunities, suggestPeople } from "@/server/matching";
import { popularTags } from "@/server/tags";
import { listSavedPosts } from "@/server/posts";
import { connectAction } from "@/app/actions/social";
import { ButtonLink } from "./ui/button";
import { Avatar, ProfileCover } from "./ui/avatar";
import { ActionButton } from "./ui/action-button";
import { TagChip } from "./ui/misc";
import { MatchBadge } from "./match";
import { ownerOf } from "./opportunity-card";
import { Metrics, Module } from "./colmeia/blocks";
import { GlyphBadge } from "./colmeia/pixel-icon";

/**
 * The signed-in member's own card: panoramic cover, honeycomb portrait over it, identity,
 * network counts that open the real lists, and the way into their profile.
 */
export async function ProfileSummary({ viewer }: { viewer: Viewer }) {
  const card = await getOwnProfileCard(viewer);
  const base = `/u/${card.username}`;
  return (
    <section className="panel cm-mini" aria-labelledby="own-profile-name">
      <div className="relative">
        <ProfileCover imageKey={card.coverKey} art={card.coverArt} seed={card.username} className="cm-mini-cover" />
        {/* Secondary access: editing stays one tap away without taking height from the card. */}
        <Link href="/profile/edit" className="cm-cover-edit" aria-label="Edit profile" title="Edit profile">
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="cm-mini-body">
        <Avatar name={card.displayName} imageKey={card.avatarKey} art={card.avatarArt} size="lg" />
        <h2 id="own-profile-name" className="cm-mini-name">
          <Link href={base} className="hover:underline hover:underline-offset-4">
            {card.displayName}
          </Link>
        </h2>
        <p className="mt-1 text-xs text-muted">@{card.username}</p>
        {card.headline && <p className="mb-1 mt-1.5 text-[13px] leading-snug [overflow-wrap:break-word]">{card.headline}</p>}
        <Metrics
          items={[
            { label: "Connections", value: card.connections, href: `${base}/connections` },
            { label: "Followers", value: card.followers, href: `${base}/connections?tab=followers` },
            { label: "Following", value: card.following, href: `${base}/connections?tab=following` },
          ]}
        />
        <ButtonLink href={base} className="mb-1 w-full">
          View profile <span aria-hidden="true">▸</span>
        </ButtonLink>
      </div>
    </section>
  );
}

export async function RecommendedOpportunities({ viewer }: { viewer: Viewer }) {
  const recs = await recommendOpportunities(viewer.id, 4);
  return (
    <Module id="rail-opportunities" title="Opportunities" icon="briefcase" more={{ href: "/opportunities?sort=match", label: "See all" }}>
      {recs.length === 0 ? (
        <p className="cm-row text-[13px] text-muted">
          Add skills and availability to{" "}
          <Link href="/profile/edit" className="link">
            your profile
          </Link>{" "}
          to get matched with opportunities.
        </p>
      ) : (
        <ul>
          {recs.map(({ opportunity: o, match }) => (
            <li key={o.id} className="cm-row flex items-start gap-2.5">
              <GlyphBadge name={o.project ? "garden" : "briefcase"} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <Link href={`/opportunities/${o.id}`} className="block text-sm font-bold leading-snug hover:underline">
                  {o.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{ownerOf(o).name}</p>
                <MatchBadge score={match.score} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}

export async function PeopleYouMayKnow({ viewer }: { viewer: Viewer }) {
  const people = await suggestPeople(viewer.id, 4);
  if (people.length === 0) return null;
  return (
    <Module id="rail-people" title="People to meet" icon="users" more={{ href: "/network", label: "My network" }}>
      <ul>
        {people.map(({ user, reason }) => {
          const name = user.profile?.displayName ?? user.username;
          return (
            <li key={user.id} className="cm-row cm-person">
              {/* Name and portrait open the profile; the connect action stays a separate control. */}
              <Link href={`/u/${user.username}`} className="cm-person-who hover:[&_strong]:underline">
                <Avatar name={name} imageKey={user.profile?.avatarKey} art={user.profile?.avatarArt} size="sm" />
                <span className="min-w-0">
                  <strong className="block text-sm leading-tight">{name}</strong>
                  <span className="block text-xs text-muted">{reason}</span>
                </span>
              </Link>
              {viewer.emailVerified && (
                <ActionButton action={connectAction} fields={{ userId: user.id }} size="sm" ariaLabel={`Connect with ${name}`}>
                  Connect
                </ActionButton>
              )}
            </li>
          );
        })}
      </ul>
    </Module>
  );
}

export async function TrendingTags() {
  await connection();
  const tags = await popularTags(14);
  if (tags.length === 0) return null;
  return (
    <Module id="rail-tags" title="Popular tags" icon="jar">
      <div className="flex flex-wrap gap-1.5 py-2">
        {tags.map((t) => (
          <TagChip key={t.slug} slug={t.slug} name={t.name} />
        ))}
      </div>
    </Module>
  );
}

/** A peek at the member's saved posts (visible only to them). */
export async function SavedPreview({ viewer }: { viewer: Viewer }) {
  const saved = await listSavedPosts(viewer, { take: 3 });
  return (
    <Module id="rail-saved" title="Your saved items" icon="bookmark" more={{ href: "/saved", label: "See saved" }}>
      {saved.length === 0 ? (
        <p className="cm-row text-[13px] text-muted">When you save a post, it appears here.</p>
      ) : (
        <ul>
          {saved.map((p) => {
            const name = p.project?.name ?? p.organization?.name ?? p.author.profile?.displayName ?? p.author.username;
            return (
              <li key={p.id} className="cm-row">
                <Link href={`/posts/${p.id}`} className="block min-h-11 hover:[&_strong]:underline">
                  <strong className="block text-sm">{name}</strong>
                  <span className="line-clamp-2 block text-xs text-muted">{p.body || "Shared post"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Module>
  );
}
