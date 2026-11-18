import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { postSchema } from "@/lib/validation";
import { extractHashtags, extractMentions, truncate } from "@/lib/text";
import { db, type Tx } from "./db";
import { audit } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { blockedUserIds, getOrgRole, getProjectRole, hasRank, isBlockedEitherWay, resolveActingAs } from "./authz";
import { resolveHandles, type HandleTarget } from "./handles";
import { notify } from "./notifications";
import { rateLimit } from "./security/rate-limit";
import { setPostTags } from "./tags";
import { assertOwnedMedia } from "./uploads";
import { entityAdmins } from "./partnerships";
import { isStaff, type Actor, type Viewer } from "./auth/types";

const MAX_ENTITY_FANOUT = 500;

const postCore = {
  id: true,
  type: true,
  body: true,
  linkUrl: true,
  status: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  createdAt: true,
  authorId: true,
  organizationId: true,
  projectId: true,
  author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, headline: true, avatarKey: true, avatarArt: true } } } },
  organization: { select: { id: true, slug: true, name: true, logoKey: true, status: true } },
  project: { select: { id: true, slug: true, name: true, logoKey: true, status: true, visibility: true } },
  opportunity: {
    select: {
      id: true, title: true, status: true, collaborationType: true, workMode: true, isPaid: true,
      tags: { where: { kind: "SKILL" as const }, take: 6, select: { tag: { select: { slug: true, name: true } } } },
    },
  },
  images: { orderBy: { position: "asc" as const }, select: { key: true, alt: true } },
  mentions: { select: { handle: true, userId: true, organizationId: true, projectId: true } },
} as const;

export const postSelect = {
  ...postCore,
  repostOf: { select: postCore },
} as const;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;
export type PostCore = Prisma.PostGetPayload<{ select: typeof postCore }>;

/** Posts visible to the public / a viewer: published, active author, visible entity, not blocked. */
export function visiblePostWhere(blocked: string[] = []): Prisma.PostWhereInput {
  return {
    status: "PUBLISHED",
    author: { status: "ACTIVE" },
    AND: [
      { OR: [{ projectId: null }, { project: { status: "ACTIVE", visibility: "PUBLIC" } }] },
      { OR: [{ organizationId: null }, { organization: { status: "ACTIVE" } }] },
      ...(blocked.length ? [{ authorId: { notIn: blocked } }] : []),
    ],
  };
}

function isCoreVisible(p: PostCore | null | undefined, blocked: Set<string>) {
  if (!p) return false;
  if (p.status !== "PUBLISHED" || p.author.status !== "ACTIVE" || blocked.has(p.authorId)) return false;
  if (p.project && (p.project.status !== "ACTIVE" || p.project.visibility !== "PUBLIC")) return false;
  if (p.organization && p.organization.status !== "ACTIVE") return false;
  return true;
}

export type HydratedPost = Omit<PostRow, "repostOf"> & {
  repostOf: PostCore | null;
  repostUnavailable: boolean;
  liked: boolean;
  saved: boolean;
  /** Viewer state for the reposted original (used by plain shares). */
  repostLiked: boolean;
  repostSaved: boolean;
  canDelete: boolean;
};

/** Adds viewer-specific state and hides reposted content that is no longer visible. */
export async function hydratePosts(viewer: Viewer | null, posts: PostRow[]): Promise<HydratedPost[]> {
  if (posts.length === 0) return [];
  const ids = [...new Set([...posts.map((p) => p.id), ...posts.flatMap((p) => (p.repostOf ? [p.repostOf.id] : []))])];
  const blocked = new Set(viewer ? await blockedUserIds(viewer.id) : []);
  const [likes, saves, adminProjects, adminOrgs] = viewer
    ? await Promise.all([
        db.reaction.findMany({ where: { userId: viewer.id, postId: { in: ids } }, select: { postId: true } }),
        db.savedPost.findMany({ where: { userId: viewer.id, postId: { in: ids } }, select: { postId: true } }),
        db.projectMember.findMany({ where: { userId: viewer.id, role: { in: ["OWNER", "ADMIN"] } }, select: { projectId: true } }),
        db.organizationMember.findMany({ where: { userId: viewer.id, role: { in: ["OWNER", "ADMIN"] } }, select: { organizationId: true } }),
      ])
    : [[], [], [], []];
  const liked = new Set(likes.map((l) => l.postId));
  const saved = new Set(saves.map((s) => s.postId));
  const pAdmin = new Set(adminProjects.map((p) => p.projectId));
  const oAdmin = new Set(adminOrgs.map((o) => o.organizationId));
  return posts.map((p) => {
    const repostVisible = p.repostOf ? isCoreVisible(p.repostOf, blocked) : false;
    return {
      ...p,
      repostOf: repostVisible ? p.repostOf : null,
      repostUnavailable: p.repostOf ? !repostVisible : false,
      liked: liked.has(p.id),
      saved: saved.has(p.id),
      repostLiked: p.repostOf ? liked.has(p.repostOf.id) : false,
      repostSaved: p.repostOf ? saved.has(p.repostOf.id) : false,
      canDelete:
        !!viewer &&
        (p.authorId === viewer.id || (p.projectId ? pAdmin.has(p.projectId) : false) || (p.organizationId ? oAdmin.has(p.organizationId) : false)),
    };
  });
}

async function storeMentions(tx: Tx, container: { postId: string } | { commentId: string }, handles: string[]) {
  const targets = await resolveHandles(handles);
  if (targets.length === 0) return [];
  await tx.mention.createMany({
    data: targets.map((t) => ({
      ...container,
      handle: t.handle.toLowerCase(),
      userId: t.kind === "user" ? t.id : null,
      organizationId: t.kind === "org" ? t.id : null,
      projectId: t.kind === "project" ? t.id : null,
    })),
  });
  return targets;
}

async function notifyMentions(actor: Actor, targets: HandleTarget[], href: string, text: string) {
  const recipients = new Set<string>();
  for (const t of targets) {
    if (t.kind === "user") recipients.add(t.id);
    else for (const id of await entityAdmins(t.kind === "org" ? { organizationId: t.id } : { projectId: t.id })) recipients.add(id);
  }
  recipients.delete(actor.id);
  for (const userId of [...recipients].slice(0, 50)) {
    if (await isBlockedEitherWay(actor.id, userId)) continue;
    await notify({ userId, type: "MENTION", actorId: actor.id, href, text });
  }
}

export async function createPost(actor: Actor, input: z.infer<typeof postSchema>) {
  await rateLimit("post", actor.id);
  const acting = await resolveActingAs(actor, input.actingAs);
  await assertOwnedMedia(actor, input.imageKeys);

  let repostOf: { id: string; authorId: string } | null = null;
  if (input.repostOfId) {
    const original = await db.post.findFirst({ where: { id: input.repostOfId, ...visiblePostWhere() }, select: { id: true, authorId: true, repostOfId: true } });
    if (!original) throw new NotFoundError("That post is no longer available.");
    if (await isBlockedEitherWay(actor.id, original.authorId)) throw new NotFoundError("That post is no longer available.");
    // Sharing a share shares the original.
    repostOf = original.repostOfId ? await db.post.findUnique({ where: { id: original.repostOfId }, select: { id: true, authorId: true } }) : original;
    if (!repostOf) throw new NotFoundError("That post is no longer available.");
  }
  if (input.opportunityId) {
    const o = await db.opportunity.findUnique({ where: { id: input.opportunityId }, select: { status: true } });
    if (!o || o.status !== "OPEN") throw new ValidationError("That opportunity is not open.");
  }

  const me = await db.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } });
  let post;
  try {
    post = await db.$transaction(async (tx) => {
      const p = await tx.post.create({
        data: {
          authorId: actor.id,
          organizationId: acting.kind === "org" ? acting.organizationId : null,
          projectId: acting.kind === "project" ? acting.projectId : null,
          type: repostOf ? "TEXT" : input.type,
          body: input.body,
          linkUrl: input.linkUrl ?? null,
          opportunityId: input.opportunityId ?? null,
          repostOfId: repostOf?.id ?? null,
          images: { create: input.imageKeys.map((key, i) => ({ key, position: i })) },
        },
      });
      if (repostOf) await tx.post.update({ where: { id: repostOf.id }, data: { shareCount: { increment: 1 } } });
      await setPostTags(p.id, extractHashtags(input.body), tx);
      const targets = await storeMentions(tx, { postId: p.id }, extractMentions(input.body));
      return { ...p, targets };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("You've already shared this post.");
    throw e;
  }

  const name = me?.displayName ?? "Someone";
  if (repostOf && repostOf.authorId !== actor.id) {
    await notify({ userId: repostOf.authorId, type: "POST_SHARE", actorId: actor.id, href: `/posts/${post.id}`, text: `${name} shared your post.` });
  }
  await notifyMentions(actor, post.targets, `/posts/${post.id}`, `${name} mentioned you: “${truncate(input.body, 80)}”`);
  if (acting.kind !== "user") await notifyEntityFollowers(actor, acting, post.id);
  return post;
}

async function notifyEntityFollowers(actor: Actor, acting: { kind: "org"; organizationId: string } | { kind: "project"; projectId: string }, postId: string) {
  const where = acting.kind === "org" ? { organizationId: acting.organizationId } : { projectId: acting.projectId };
  const [entity, followers] = await Promise.all([
    acting.kind === "org"
      ? db.organization.findUnique({ where: { id: acting.organizationId }, select: { name: true } })
      : db.project.findUnique({ where: { id: acting.projectId }, select: { name: true } }),
    db.follow.findMany({ where: { ...where, status: "ACTIVE", follower: { status: "ACTIVE" } }, select: { followerId: true }, take: MAX_ENTITY_FANOUT }),
  ]);
  for (const f of followers) {
    await notify({ userId: f.followerId, type: "ENTITY_UPDATE", actorId: actor.id, href: `/posts/${postId}`, text: `${entity?.name ?? "A page you follow"} posted an update.` });
  }
}

async function canModeratePost(actor: Actor, p: { authorId: string; projectId: string | null; organizationId: string | null }) {
  if (p.authorId === actor.id) return true;
  if (p.projectId && hasRank(await getProjectRole(actor.id, p.projectId), "ADMIN")) return true;
  if (p.organizationId && hasRank(await getOrgRole(actor.id, p.organizationId), "ADMIN")) return true;
  return false;
}

export async function deletePost(actor: Actor, postId: string) {
  const p = await db.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, projectId: true, organizationId: true, status: true, repostOfId: true } });
  if (!p || p.status !== "PUBLISHED") throw new NotFoundError("Post not found.");
  if (!(await canModeratePost(actor, p))) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: p.id }, data: { status: "DELETED" } });
    if (p.repostOfId) await tx.post.updateMany({ where: { id: p.repostOfId, shareCount: { gt: 0 } }, data: { shareCount: { decrement: 1 } } });
  });
  if (p.authorId !== actor.id) await audit({ actorId: actor.id, action: "post.deleted_by_admin", entityType: "Post", entityId: p.id });
}

export async function getPost(viewer: Viewer | null, postId: string) {
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const where: Prisma.PostWhereInput = isStaff(viewer) ? { id: postId, status: { not: "DELETED" } } : { id: postId, ...visiblePostWhere(blocked) };
  const p = await db.post.findFirst({ where, select: postSelect });
  if (!p) return null;
  const [hydrated] = await hydratePosts(viewer, [p]);
  return hydrated;
}

export async function listComments(viewer: Viewer | null, postId: string) {
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const comments = await db.comment.findMany({
    where: { postId, status: "PUBLISHED", author: { status: "ACTIVE" }, ...(blocked.length ? { authorId: { notIn: blocked } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true, body: true, parentId: true, createdAt: true, authorId: true,
      author: { select: { username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } },
      mentions: { select: { handle: true, userId: true, organizationId: true, projectId: true } },
    },
  });
  const top = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);
  return top.map((c) => ({ ...c, replies: replies.filter((r) => r.parentId === c.id) }));
}

export async function toggleLike(actor: Actor, postId: string) {
  const post = await db.post.findFirst({ where: { id: postId, ...visiblePostWhere() }, select: { id: true, authorId: true } });
  if (!post) throw new NotFoundError("Post not found.");
  if (await isBlockedEitherWay(actor.id, post.authorId)) throw new NotFoundError("Post not found.");
  const existing = await db.reaction.findUnique({ where: { postId_userId: { postId, userId: actor.id } } });
  if (existing) {
    await db.$transaction([
      db.reaction.delete({ where: { postId_userId: { postId, userId: actor.id } } }),
      db.post.updateMany({ where: { id: postId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } }),
    ]);
    return { liked: false };
  }
  try {
    await db.$transaction([
      db.reaction.create({ data: { postId, userId: actor.id } }),
      db.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { liked: true }; // double click: already liked
    throw e;
  }
  if (post.authorId !== actor.id) {
    const recent = await db.notification.count({ where: { userId: post.authorId, actorId: actor.id, type: "POST_LIKE", href: `/posts/${postId}` } });
    if (recent === 0) {
      const me = await db.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } });
      await notify({ userId: post.authorId, type: "POST_LIKE", actorId: actor.id, href: `/posts/${postId}`, text: `${me?.displayName ?? "Someone"} liked your post.` });
    }
  }
  return { liked: true };
}

export async function addComment(actor: Actor, input: { postId: string; parentId?: string; body: string }) {
  await rateLimit("comment", actor.id);
  const post = await db.post.findFirst({ where: { id: input.postId, ...visiblePostWhere() }, select: { id: true, authorId: true } });
  if (!post) throw new NotFoundError("Post not found.");
  if (await isBlockedEitherWay(actor.id, post.authorId)) throw new NotFoundError("Post not found.");
  let parent: { id: string; authorId: string; parentId: string | null } | null = null;
  if (input.parentId) {
    parent = await db.comment.findFirst({ where: { id: input.parentId, postId: post.id, status: "PUBLISHED" }, select: { id: true, authorId: true, parentId: true } });
    if (!parent) throw new NotFoundError("That comment is no longer available.");
  }
  // One level of threading: replies to replies attach to the top-level comment.
  const parentId = parent ? parent.parentId ?? parent.id : null;
  const comment = await db.$transaction(async (tx) => {
    const c = await tx.comment.create({ data: { postId: post.id, authorId: actor.id, parentId, body: input.body } });
    await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
    const targets = await storeMentions(tx, { commentId: c.id }, extractMentions(input.body));
    return { ...c, targets };
  });
  const me = await db.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } });
  const name = me?.displayName ?? "Someone";
  const href = `/posts/${post.id}#c-${comment.id}`;
  const notified = new Set<string>([actor.id]);
  if (!notified.has(post.authorId)) {
    await notify({ userId: post.authorId, type: "POST_COMMENT", actorId: actor.id, href, text: `${name} commented: “${truncate(input.body, 80)}”` });
    notified.add(post.authorId);
  }
  if (parent) {
    // Notify the comment being answered and the author who started the thread.
    const threadStarter = parent.parentId
      ? (await db.comment.findUnique({ where: { id: parent.parentId }, select: { authorId: true } }))?.authorId
      : null;
    for (const userId of [parent.authorId, threadStarter]) {
      if (!userId || notified.has(userId)) continue;
      await notify({ userId, type: "COMMENT_REPLY", actorId: actor.id, href, text: `${name} replied: “${truncate(input.body, 80)}”` });
      notified.add(userId);
    }
  }
  await notifyMentions(actor, comment.targets.filter((t) => !(t.kind === "user" && notified.has(t.id))), href, `${name} mentioned you in a comment.`);
  return comment;
}

export async function deleteComment(actor: Actor, commentId: string) {
  const c = await db.comment.findUnique({ where: { id: commentId }, include: { post: { select: { authorId: true, projectId: true, organizationId: true } } } });
  if (!c || c.status !== "PUBLISHED") throw new NotFoundError("Comment not found.");
  const allowed = c.authorId === actor.id || (await canModeratePost(actor, c.post));
  if (!allowed) throw new ForbiddenError();
  const replyCount = await db.comment.count({ where: { parentId: c.id, status: "PUBLISHED" } });
  await db.$transaction([
    db.comment.updateMany({ where: { OR: [{ id: c.id }, { parentId: c.id }], status: "PUBLISHED" }, data: { status: "DELETED" } }),
    db.post.updateMany({ where: { id: c.postId, commentCount: { gte: 1 + replyCount } }, data: { commentCount: { decrement: 1 + replyCount } } }),
  ]);
}

export async function toggleSave(actor: Actor, postId: string) {
  const existing = await db.savedPost.findUnique({ where: { userId_postId: { userId: actor.id, postId } } });
  if (existing) {
    await db.savedPost.delete({ where: { userId_postId: { userId: actor.id, postId } } });
    return { saved: false };
  }
  const post = await db.post.findFirst({ where: { id: postId, ...visiblePostWhere() }, select: { id: true } });
  if (!post) throw new NotFoundError("Post not found.");
  await db.savedPost.upsert({ where: { userId_postId: { userId: actor.id, postId } }, create: { userId: actor.id, postId }, update: {} });
  return { saved: true };
}

export async function listSavedPosts(viewer: Viewer, opts: { take?: number } = {}) {
  const blocked = await blockedUserIds(viewer.id);
  const rows = await db.savedPost.findMany({
    where: { userId: viewer.id, post: visiblePostWhere(blocked) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 100, 100),
    select: { post: { select: postSelect } },
  });
  return hydratePosts(viewer, rows.map((r) => r.post));
}

export type PostScope = { authorId: string; asSelfOnly?: boolean } | { organizationId: string } | { projectId: string } | { tagSlug: string };

/** Posts by a person (as themselves), an organization, a project or with a hashtag. */
export async function listPostsFor(viewer: Viewer | null, scope: PostScope, opts: { cursor?: string; take?: number } = {}) {
  const take = opts.take ?? 20;
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  let where: Prisma.PostWhereInput;
  if ("authorId" in scope) where = { authorId: scope.authorId, ...(scope.asSelfOnly ? { organizationId: null, projectId: null } : {}) };
  else if ("organizationId" in scope) where = { organizationId: scope.organizationId };
  else if ("projectId" in scope) where = { projectId: scope.projectId };
  else where = { tags: { some: { tag: { slug: scope.tagSlug } } } };
  const rows = await db.post.findMany({
    where: { AND: [where, visiblePostWhere(blocked)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: postSelect,
  });
  const items = await hydratePosts(viewer, rows.slice(0, take));
  return { items, nextCursor: rows.length > take ? rows[take - 1].id : null };
}

/** Members who liked a post (visible to anyone who can see the post). */
export async function listLikers(postId: string, take = 50) {
  return db.reaction.findMany({
    where: { postId, user: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { user: { select: { username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } } },
  });
}
