import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "./auth/types";
import { db } from "./db";

/** Private analytics: callers supply the authenticated actor, never a requested user ID. */
export async function personalAnalytics(actor: Actor) {
  const until = new Date();
  const since = new Date(until.getTime() - 30 * 86400 * 1000);
  const window = { gte: since, lte: until };
  const ownPosts: Prisma.PostWhereInput = { authorId: actor.id, status: "PUBLISHED", projectId: null, organizationId: null };
  const otherUser = { not: actor.id };
  const [followers, connections, posts, likes, comments, shares, recentPosts] = await Promise.all([
    db.follow.count({ where: { userId: actor.id, status: "ACTIVE", follower: { status: "ACTIVE" } } }),
    db.connection.count({ where: { status: "ACCEPTED", OR: [{ userAId: actor.id }, { userBId: actor.id }], userA: { status: "ACTIVE" }, userB: { status: "ACTIVE" } } }),
    db.post.count({ where: { ...ownPosts, createdAt: window } }),
    db.reaction.count({ where: { post: ownPosts, userId: otherUser, user: { status: "ACTIVE" }, createdAt: window } }),
    db.comment.count({ where: { post: ownPosts, authorId: otherUser, author: { status: "ACTIVE" }, status: "PUBLISHED", createdAt: window } }),
    db.post.count({ where: { repostOf: ownPosts, authorId: otherUser, author: { status: "ACTIVE" }, status: "PUBLISHED", createdAt: window } }),
    db.post.findMany({ where: { ...ownPosts, createdAt: window }, orderBy: { createdAt: "desc" }, take: 10, select: {
      id: true, body: true, createdAt: true,
      _count: { select: {
        reactions: { where: { userId: otherUser, user: { status: "ACTIVE" }, createdAt: window } },
        comments: { where: { authorId: otherUser, author: { status: "ACTIVE" }, status: "PUBLISHED", createdAt: window } },
        reposts: { where: { authorId: otherUser, author: { status: "ACTIVE" }, status: "PUBLISHED", createdAt: window } },
      } },
    } }),
  ]);
  return { since, until, followers, connections, posts, likes, comments, shares, interactions: likes + comments + shares, recentPosts };
}
