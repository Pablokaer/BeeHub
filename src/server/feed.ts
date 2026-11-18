import "server-only";
import { FEED_CONFIG } from "@/config/feed";
import { db } from "./db";
import { blockedUserIds } from "./authz";
import { connectionIds } from "./social/graph";
import { hydratePosts, postSelect, visiblePostWhere, type PostRow } from "./posts";
import type { Viewer } from "./auth/types";

/** Everything the ranker knows about the viewer's graph and interests. */
export type FeedContext = {
  viewerId: string;
  connections: Set<string>;
  followedUsers: Set<string>;
  followedProjects: Set<string>;
  followedOrgs: Set<string>;
  teamProjects: Set<string>;
  teamOrgs: Set<string>;
  tagIds: Set<string>;
  now: Date;
};

type Candidate = PostRow & { tags: { tagId: string }[]; opportunityTagIds: string[] };
type CandidateRow = Omit<PostRow, "opportunity"> & {
  tags: { tagId: string }[];
  opportunity: (Omit<NonNullable<PostRow["opportunity"]>, "tags"> & { tags: { tagId: string; kind: string; tag: { slug: string; name: string } }[] }) | null;
};

export interface FeedRanker {
  score(post: Candidate, ctx: FeedContext): { score: number; reason: string | null };
}

/** Deterministic, explainable ranking (see src/config/feed.ts). */
export class RuleBasedRanker implements FeedRanker {
  score(p: Candidate, ctx: FeedContext) {
    const w = FEED_CONFIG.weights;
    let relevance = 0;
    let reason: string | null = null;
    const bump = (value: number, why: string | null) => {
      if (value > relevance) reason = why ?? reason;
      relevance = Math.max(relevance, value);
    };
    if (p.authorId === ctx.viewerId) bump(w.ownPost, null);
    if (ctx.connections.has(p.authorId) && !p.projectId && !p.organizationId) bump(w.connection, "From your network");
    if (ctx.followedUsers.has(p.authorId) && !p.projectId && !p.organizationId) bump(w.followedPerson, "From someone you follow");
    if (p.projectId && ctx.teamProjects.has(p.projectId)) bump(w.teamEntity, "From your project");
    if (p.organizationId && ctx.teamOrgs.has(p.organizationId)) bump(w.teamEntity, "From your organization");
    if (p.projectId && ctx.followedProjects.has(p.projectId)) bump(w.followedEntity, "A project you follow");
    if (p.organizationId && ctx.followedOrgs.has(p.organizationId)) bump(w.followedEntity, "An organization you follow");
    if (p.opportunity && p.opportunityTagIds.some((t) => ctx.tagIds.has(t))) bump(w.matchingOpportunity, "Matches your skills");
    const shared = p.tags.filter((t) => ctx.tagIds.has(t.tagId)).length;
    if (shared) bump(Math.min(shared, w.tagOverlapCap) * w.tagOverlap, "Related to your interests");
    if (relevance === 0) relevance = w.discovery;

    const engagement = Math.log1p(p.likeCount + 2 * p.commentCount + 3 * p.shareCount) * w.engagement;
    const ageHours = (ctx.now.getTime() - p.createdAt.getTime()) / 3_600_000;
    const decay = Math.pow(0.5, ageHours / FEED_CONFIG.halfLifeHours);
    return { score: (relevance + engagement) * decay, reason };
  }
}

async function buildContext(viewerId: string): Promise<FeedContext> {
  const [connections, follows, projects, orgs, tags] = await Promise.all([
    connectionIds(viewerId),
    db.follow.findMany({ where: { followerId: viewerId, status: "ACTIVE" }, select: { userId: true, projectId: true, organizationId: true } }),
    db.projectMember.findMany({ where: { userId: viewerId }, select: { projectId: true } }),
    db.organizationMember.findMany({ where: { userId: viewerId }, select: { organizationId: true } }),
    db.userTag.findMany({ where: { userId: viewerId }, select: { tagId: true } }),
  ]);
  return {
    viewerId,
    connections: new Set(connections),
    followedUsers: new Set(follows.flatMap((f) => (f.userId ? [f.userId] : []))),
    followedProjects: new Set(follows.flatMap((f) => (f.projectId ? [f.projectId] : []))),
    followedOrgs: new Set(follows.flatMap((f) => (f.organizationId ? [f.organizationId] : []))),
    teamProjects: new Set(projects.map((p) => p.projectId)),
    teamOrgs: new Set(orgs.map((o) => o.organizationId)),
    tagIds: new Set(tags.map((t) => t.tagId)),
    now: new Date(),
  };
}

const candidateSelect = {
  ...postSelect,
  tags: { select: { tagId: true } },
  opportunity: { select: { ...postSelect.opportunity.select, tags: { select: { tagId: true, kind: true, tag: { select: { slug: true, name: true } } } } } },
} as const;

export type FeedMode = "for-you" | "latest";

/**
 * "For you": candidates from the last N days, scored by the ranker, paged in memory.
 * "Latest": the viewer's network and follows in reverse-chronological order.
 */
export async function getFeed(viewer: Viewer, opts: { mode?: FeedMode; page?: number } = {}, ranker: FeedRanker = new RuleBasedRanker()) {
  const mode = opts.mode ?? "for-you";
  const page = Math.max(1, opts.page ?? 1);
  const size = FEED_CONFIG.pageSize;
  const [ctx, blocked] = await Promise.all([buildContext(viewer.id), blockedUserIds(viewer.id)]);

  const networkWhere = {
    OR: [
      { authorId: { in: [viewer.id, ...ctx.connections, ...ctx.followedUsers] }, projectId: null, organizationId: null },
      { projectId: { in: [...ctx.followedProjects, ...ctx.teamProjects] } },
      { organizationId: { in: [...ctx.followedOrgs, ...ctx.teamOrgs] } },
    ],
  };

  if (mode === "latest") {
    const rows = await db.post.findMany({
      where: { AND: [visiblePostWhere(blocked), networkWhere] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * size,
      take: size + 1,
      select: postSelect,
    });
    const items = await hydratePosts(viewer, rows.slice(0, size));
    return { items: items.map((p) => ({ post: p, reason: null as string | null })), hasMore: rows.length > size, mode };
  }

  const since = new Date(Date.now() - FEED_CONFIG.windowDays * 86400 * 1000);
  const rows = (await db.post.findMany({
    where: { AND: [visiblePostWhere(blocked), { createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    take: FEED_CONFIG.maxCandidates,
    select: candidateSelect,
  })) as unknown as CandidateRow[];

  const scored = rows
    .map((r) => {
      const candidate = { ...r, opportunityTagIds: r.opportunity?.tags.map((t) => t.tagId) ?? [] } as unknown as Candidate;
      return { row: r, ...ranker.score(candidate, ctx) };
    })
    .sort((a, b) => b.score - a.score || b.row.createdAt.getTime() - a.row.createdAt.getTime());

  const slice = scored.slice((page - 1) * size, page * size);
  const posts: PostRow[] = slice.map((s) => {
    const { tags: _tags, ...rest } = s.row;
    void _tags;
    return {
      ...rest,
      opportunity: rest.opportunity
        ? { ...rest.opportunity, tags: rest.opportunity.tags.filter((t) => t.kind === "SKILL").slice(0, 6).map((t) => ({ tag: t.tag })) }
        : null,
    } as PostRow;
  });
  const hydrated = await hydratePosts(viewer, posts);
  return {
    items: hydrated.map((p, i) => ({ post: p, reason: slice[i].reason })),
    hasMore: scored.length > page * size,
    mode,
  };
}

/** Public, signed-out view: most recent public posts. */
export async function getPublicFeed(take = 10) {
  const rows = await db.post.findMany({ where: visiblePostWhere(), orderBy: { createdAt: "desc" }, take, select: postSelect });
  return hydratePosts(null, rows);
}
