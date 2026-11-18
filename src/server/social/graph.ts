import "server-only";
import type { ConnectionStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "../db";
import { audit } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "../errors";
import { isBlockedEitherWay } from "../authz";
import { notify } from "../notifications";
import { rateLimit } from "../security/rate-limit";
import type { Actor } from "../auth/types";
import { userCardSelect } from "../selects";

export { userCardSelect };

/** Declined requests can't be re-sent by the same requester for this long. */
export const RE_REQUEST_COOLDOWN_DAYS = 14;

export function pair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

async function activeUser(userId: string, tx: Tx = db) {
  const u = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, status: true, profile: { select: { displayName: true, followApproval: true } } },
  });
  if (!u || u.status !== "ACTIVE") throw new NotFoundError("This member is not available.");
  return u;
}

async function displayNameOf(userId: string, tx: Tx = db) {
  const p = await tx.profile.findUnique({ where: { userId }, select: { displayName: true } });
  return p?.displayName ?? "Someone";
}

// ───────────── Connections ─────────────

export async function getConnection(a: string, b: string, tx: Tx = db) {
  if (a === b) return null;
  return tx.connection.findUnique({ where: { userAId_userBId: pair(a, b) } });
}

export async function areConnected(a: string, b: string, tx: Tx = db) {
  const c = await getConnection(a, b, tx);
  return c?.status === "ACCEPTED";
}

export async function sendConnectionRequest(actor: Actor, targetUserId: string, message?: string) {
  if (actor.id === targetUserId) throw new ValidationError("You can't connect with yourself.");
  const target = await activeUser(targetUserId);
  if (await isBlockedEitherWay(actor.id, targetUserId)) throw new NotFoundError("This member is not available.");
  await rateLimit("connectionRequest", actor.id);
  const key = pair(actor.id, targetUserId);
  const me = await displayNameOf(actor.id);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.connection.findUnique({ where: { userAId_userBId: key } });
    if (existing?.status === "ACCEPTED") throw new ConflictError("You're already connected.");
    if (existing?.status === "PENDING") {
      if (existing.requesterId === actor.id) throw new ConflictError("Your request is already pending.");
      // The other person already asked: treat a mirror request as acceptance.
      await tx.connection.update({ where: { userAId_userBId: key }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      await notify({ userId: targetUserId, type: "CONNECTION_ACCEPTED", actorId: actor.id, href: `/u/${actor.username}`, text: `${me} accepted your connection request.` }, tx);
      return "accepted" as const;
    }
    if (existing?.status === "DECLINED") {
      const cooldown = RE_REQUEST_COOLDOWN_DAYS * 86400 * 1000;
      if (existing.requesterId === actor.id && existing.respondedAt && Date.now() - existing.respondedAt.getTime() < cooldown) {
        throw new ConflictError("You can send a new request to this member later.");
      }
      await tx.connection.update({
        where: { userAId_userBId: key },
        data: { status: "PENDING", requesterId: actor.id, message: message ?? null, createdAt: new Date(), respondedAt: null },
      });
    } else {
      await tx.connection.create({ data: { ...key, requesterId: actor.id, message: message ?? null } });
    }
    await notify({ userId: targetUserId, type: "CONNECTION_REQUEST", actorId: actor.id, href: "/network/requests", text: `${me} wants to connect with you.` }, tx);
    return "requested" as const;
  }).catch((e) => {
    if (isUniqueViolation(e)) throw new ConflictError("Your request is already pending.");
    throw e;
  });
  return { status: result, target: target.username };
}

export async function respondToConnectionRequest(actor: Actor, otherUserId: string, accept: boolean) {
  const key = pair(actor.id, otherUserId);
  const row = await db.connection.findUnique({ where: { userAId_userBId: key } });
  if (!row || row.status !== "PENDING" || row.requesterId === actor.id) throw new NotFoundError("This request is no longer available.");
  await db.$transaction(async (tx) => {
    await tx.connection.update({
      where: { userAId_userBId: key },
      data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
    });
    if (accept) {
      const me = await displayNameOf(actor.id, tx);
      await notify({ userId: otherUserId, type: "CONNECTION_ACCEPTED", actorId: actor.id, href: `/u/${actor.username}`, text: `${me} accepted your connection request.` }, tx);
    }
  });
}

export async function cancelConnectionRequest(actor: Actor, otherUserId: string) {
  const key = pair(actor.id, otherUserId);
  const deleted = await db.connection.deleteMany({ where: { ...key, status: "PENDING", requesterId: actor.id } });
  if (deleted.count === 0) throw new NotFoundError("There is no pending request to cancel.");
}

export async function removeConnection(actor: Actor, otherUserId: string) {
  const key = pair(actor.id, otherUserId);
  const deleted = await db.connection.deleteMany({ where: { ...key, status: "ACCEPTED" } });
  if (deleted.count === 0) throw new NotFoundError("You're not connected with this member.");
}

export async function connectionIds(userId: string, tx: Tx = db): Promise<string[]> {
  const rows = await tx.connection.findMany({
    where: { status: "ACCEPTED", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function connectionCount(userId: string) {
  return db.connection.count({ where: { status: "ACCEPTED", OR: [{ userAId: userId }, { userBId: userId }] } });
}


export async function listConnections(userId: string, opts: { page?: number; take?: number } = {}) {
  const take = opts.take ?? 30;
  const page = Math.max(1, opts.page ?? 1);
  const ids = await connectionIds(userId);
  const users = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: userCardSelect,
    orderBy: { profile: { displayName: "asc" } },
    skip: (page - 1) * take,
    take: take + 1,
  });
  return { items: users.slice(0, take), hasMore: users.length > take, total: ids.length };
}

export async function listConnectionRequests(actor: Actor) {
  const rows = await db.connection.findMany({
    where: { status: "PENDING", OR: [{ userAId: actor.id }, { userBId: actor.id }] },
    orderBy: { createdAt: "desc" },
    select: {
      userAId: true, userBId: true, requesterId: true, message: true, createdAt: true,
      userA: { select: userCardSelect },
      userB: { select: userCardSelect },
    },
  });
  const incoming = [];
  const outgoing = [];
  for (const r of rows) {
    const other = r.userAId === actor.id ? r.userB : r.userA;
    const item = { user: other, message: r.message, createdAt: r.createdAt };
    if (r.requesterId === actor.id) outgoing.push(item);
    else incoming.push(item);
  }
  return { incoming, outgoing };
}

export async function mutualConnections(a: string, b: string, take = 5) {
  if (a === b) return { count: 0, users: [] };
  const [ca, cb] = await Promise.all([connectionIds(a), connectionIds(b)]);
  const setB = new Set(cb);
  const mutual = ca.filter((id) => setB.has(id));
  const users = mutual.length
    ? await db.user.findMany({ where: { id: { in: mutual.slice(0, take) }, status: "ACTIVE" }, select: userCardSelect })
    : [];
  return { count: mutual.length, users };
}

// ───────────── Follows ─────────────

export type FollowTarget = { userId: string } | { organizationId: string } | { projectId: string };

function targetWhere(followerId: string, t: FollowTarget) {
  if ("userId" in t) return { followerId_userId: { followerId, userId: t.userId } };
  if ("organizationId" in t) return { followerId_organizationId: { followerId, organizationId: t.organizationId } };
  return { followerId_projectId: { followerId, projectId: t.projectId } };
}

export async function follow(actor: Actor, target: FollowTarget) {
  let status: "ACTIVE" | "PENDING" = "ACTIVE";
  let notifyUser: { userId: string; type: "NEW_FOLLOWER" | "FOLLOW_REQUEST" } | null = null;

  if ("userId" in target) {
    if (target.userId === actor.id) throw new ValidationError("You can't follow yourself.");
    const u = await activeUser(target.userId);
    if (await isBlockedEitherWay(actor.id, target.userId)) throw new NotFoundError("This member is not available.");
    if (u.profile?.followApproval && !(await areConnected(actor.id, target.userId))) status = "PENDING";
    notifyUser = { userId: target.userId, type: status === "PENDING" ? "FOLLOW_REQUEST" : "NEW_FOLLOWER" };
  } else if ("organizationId" in target) {
    const org = await db.organization.findUnique({ where: { id: target.organizationId }, select: { status: true } });
    if (!org || org.status !== "ACTIVE") throw new NotFoundError("Organization not found.");
  } else {
    const p = await db.project.findUnique({ where: { id: target.projectId }, select: { status: true, visibility: true } });
    if (!p || p.status !== "ACTIVE" || p.visibility !== "PUBLIC") throw new NotFoundError("Project not found.");
  }

  const existing = await db.follow.findUnique({ where: targetWhere(actor.id, target) });
  if (existing) return existing.status;
  try {
    await db.follow.create({ data: { followerId: actor.id, ...target, status } });
  } catch (e) {
    if (isUniqueViolation(e)) return status;
    throw e;
  }
  if (notifyUser) {
    const me = await displayNameOf(actor.id);
    await notify({
      userId: notifyUser.userId,
      type: notifyUser.type,
      actorId: actor.id,
      href: notifyUser.type === "FOLLOW_REQUEST" ? "/network/requests" : `/u/${actor.username}`,
      text: notifyUser.type === "FOLLOW_REQUEST" ? `${me} asked to follow you.` : `${me} started following you.`,
    });
  }
  return status;
}

export async function unfollow(actor: Actor, target: FollowTarget) {
  await db.follow.deleteMany({ where: { followerId: actor.id, ...target } });
}

export async function respondToFollowRequest(actor: Actor, followerId: string, accept: boolean) {
  const row = await db.follow.findUnique({ where: { followerId_userId: { followerId, userId: actor.id } } });
  if (!row || row.status !== "PENDING") throw new NotFoundError("This request is no longer available.");
  if (accept) await db.follow.update({ where: { id: row.id }, data: { status: "ACTIVE" } });
  else await db.follow.delete({ where: { id: row.id } });
}

export async function listFollowRequests(actor: Actor) {
  return db.follow.findMany({
    where: { userId: actor.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, follower: { select: userCardSelect } },
  });
}

export async function followerCount(target: FollowTarget) {
  return db.follow.count({ where: { ...target, status: "ACTIVE" } });
}

export async function followingCount(userId: string) {
  return db.follow.count({ where: { followerId: userId, status: "ACTIVE" } });
}

export async function getFollowStatus(actorId: string | null | undefined, target: FollowTarget) {
  if (!actorId) return null;
  const row = await db.follow.findUnique({ where: targetWhere(actorId, target), select: { status: true } });
  return row?.status ?? null;
}

export async function listFollowers(userId: string, take = 50) {
  const rows = await db.follow.findMany({
    where: { userId, status: "ACTIVE", follower: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { follower: { select: userCardSelect } },
  });
  return rows.map((r) => r.follower);
}

export async function listFollowing(userId: string, take = 50) {
  return db.follow.findMany({
    where: { followerId: userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      user: { select: userCardSelect },
      organization: { select: { id: true, slug: true, name: true, logoKey: true, tagline: true, status: true } },
      project: { select: { id: true, slug: true, name: true, logoKey: true, summary: true, status: true, visibility: true } },
    },
  });
}

// ───────────── Blocks ─────────────

export async function blockUser(actor: Actor, targetUserId: string) {
  if (targetUserId === actor.id) throw new ValidationError("You can't block yourself.");
  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
  if (!target) throw new NotFoundError();
  if (target.role !== "USER") throw new ForbiddenError("Staff accounts can't be blocked. Report a problem instead.");
  await db.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: actor.id, blockedId: targetUserId } },
      create: { blockerId: actor.id, blockedId: targetUserId },
      update: {},
    });
    await tx.connection.deleteMany({ where: pair(actor.id, targetUserId) });
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: actor.id, userId: targetUserId }, { followerId: targetUserId, userId: actor.id }] },
    });
  });
  await audit({ actorId: actor.id, action: "user.blocked", entityType: "User", entityId: targetUserId });
}

export async function unblockUser(actor: Actor, targetUserId: string) {
  await db.block.deleteMany({ where: { blockerId: actor.id, blockedId: targetUserId } });
  await audit({ actorId: actor.id, action: "user.unblocked", entityType: "User", entityId: targetUserId });
}

export async function listBlocked(actor: Actor) {
  const rows = await db.block.findMany({
    where: { blockerId: actor.id },
    select: { createdAt: true, blocked: { select: userCardSelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function hasBlocked(blockerId: string, blockedId: string) {
  const n = await db.block.count({ where: { blockerId, blockedId } });
  return n > 0;
}

export type RelationshipState = {
  isSelf: boolean;
  connection: ConnectionStatus | null;
  connectionRequestedByViewer: boolean;
  follow: "ACTIVE" | "PENDING" | null;
  blockedByViewer: boolean;
};

export async function relationship(viewerId: string | null | undefined, targetId: string): Promise<RelationshipState> {
  if (!viewerId) return { isSelf: false, connection: null, connectionRequestedByViewer: false, follow: null, blockedByViewer: false };
  if (viewerId === targetId) return { isSelf: true, connection: null, connectionRequestedByViewer: false, follow: null, blockedByViewer: false };
  const [conn, fol, blocked] = await Promise.all([
    getConnection(viewerId, targetId),
    getFollowStatus(viewerId, { userId: targetId }),
    hasBlocked(viewerId, targetId),
  ]);
  return {
    isSelf: false,
    connection: conn?.status ?? null,
    connectionRequestedByViewer: conn?.requesterId === viewerId,
    follow: fol,
    blockedByViewer: blocked,
  };
}
