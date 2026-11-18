import "server-only";
import { truncate } from "@/lib/text";
import { db } from "./db";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isBlockedEitherWay } from "./authz";
import { areConnected } from "./social/graph";
import { haveApplicationRelation } from "./applications";
import { notify } from "./notifications";
import { rateLimit } from "./security/rate-limit";
import type { Actor } from "./auth/types";

export const conversationKey = (a: string, b: string) => [a, b].sort().join(":");

async function shareTeam(a: string, b: string) {
  const [p, o] = await Promise.all([
    db.projectMember.count({ where: { userId: a, project: { members: { some: { userId: b } } } } }),
    db.organizationMember.count({ where: { userId: a, organization: { members: { some: { userId: b } } } } }),
  ]);
  return p + o > 0;
}

export type MessagePermissionResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Who can start a conversation: nobody blocked, recipient active, and the recipient's
 * setting allows it (everyone, or only connections/teammates/application contacts).
 * Existing conversations stay open unless someone blocks.
 */
export async function canMessage(senderId: string, recipientId: string): Promise<MessagePermissionResult> {
  if (senderId === recipientId) return { allowed: false, reason: "You can't message yourself." };
  const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { status: true, profile: { select: { messagePermission: true } } } });
  if (!recipient || recipient.status !== "ACTIVE") return { allowed: false, reason: "This member is not available." };
  if (await isBlockedEitherWay(senderId, recipientId)) return { allowed: false, reason: "You can't message this member." };
  const existing = await db.conversation.findUnique({ where: { pairKey: conversationKey(senderId, recipientId) }, select: { id: true } });
  if (existing) return { allowed: true };
  if (recipient.profile?.messagePermission !== "CONNECTIONS") return { allowed: true };
  if (await areConnected(senderId, recipientId)) return { allowed: true };
  if (await haveApplicationRelation(senderId, recipientId)) return { allowed: true };
  if (await shareTeam(senderId, recipientId)) return { allowed: true };
  return { allowed: false, reason: "This member only accepts messages from their connections." };
}

export async function startConversation(actor: Actor, recipientId: string) {
  const permission = await canMessage(actor.id, recipientId);
  if (!permission.allowed) throw new ForbiddenError(permission.reason);
  const pairKey = conversationKey(actor.id, recipientId);
  const existing = await db.conversation.findUnique({ where: { pairKey }, select: { id: true } });
  if (existing) return existing.id;
  await rateLimit("newConversation", actor.id);
  const conv = await db.conversation.upsert({
    where: { pairKey },
    create: { pairKey, participants: { create: [{ userId: actor.id }, { userId: recipientId }] } },
    update: {},
    select: { id: true },
  });
  return conv.id;
}

async function participantOrThrow(actor: Actor, conversationId: string) {
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participants: {
        select: {
          userId: true, lastReadAt: true,
          user: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } },
        },
      },
    },
  });
  if (!conv || !conv.participants.some((p) => p.userId === actor.id)) throw new NotFoundError("Conversation not found.");
  const other = conv.participants.find((p) => p.userId !== actor.id)!;
  return { conv, other };
}

export async function sendMessage(actor: Actor, conversationId: string, body: string) {
  const { other } = await participantOrThrow(actor, conversationId);
  if (other.user.status !== "ACTIVE") throw new ValidationError("This member is no longer available.");
  if (await isBlockedEitherWay(actor.id, other.userId)) throw new ForbiddenError("You can't message this member.");
  await rateLimit("message", actor.id);
  const now = new Date();
  const msg = await db.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { conversationId, senderId: actor.id, body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: actor.id } }, data: { lastReadAt: now } });
    return m;
  });
  // One unread notification per conversation is enough.
  const href = `/messages/${conversationId}`;
  const pending = await db.notification.count({ where: { userId: other.userId, type: "NEW_MESSAGE", href, readAt: null } });
  if (pending === 0) {
    const me = await db.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } });
    await notify({ userId: other.userId, type: "NEW_MESSAGE", actorId: actor.id, href, text: `${me?.displayName ?? "Someone"}: ${truncate(body, 80)}` });
  }
  return msg;
}

export async function listConversations(actor: Actor) {
  const rows = await db.conversationParticipant.findMany({
    where: { userId: actor.id },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true, lastMessageAt: true,
          participants: {
            where: { userId: { not: actor.id } },
            select: { user: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } } },
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
        },
      },
    },
  });
  return rows
    .filter((r) => r.conversation.messages.length > 0 || true)
    .map((r) => {
      const last = r.conversation.messages[0] ?? null;
      const other = r.conversation.participants[0]?.user ?? null;
      const unread = !!last && last.senderId !== actor.id && (!r.lastReadAt || r.lastReadAt < last.createdAt);
      return { id: r.conversation.id, other, last, unread, lastMessageAt: r.conversation.lastMessageAt };
    });
}

export async function getConversation(actor: Actor, conversationId: string, opts: { markRead?: boolean } = {}) {
  const { other } = await participantOrThrow(actor, conversationId);
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, body: true, senderId: true, createdAt: true },
  });
  if (opts.markRead !== false) await markConversationRead(actor, conversationId);
  const [blocked, permission] = await Promise.all([
    isBlockedEitherWay(actor.id, other.userId),
    canMessage(actor.id, other.userId),
  ]);
  return {
    id: conversationId,
    other: other.user,
    otherLastReadAt: other.lastReadAt,
    messages: messages.reverse(),
    canSend: other.user.status === "ACTIVE" && !blocked && permission.allowed,
    blocked,
  };
}

export async function markConversationRead(actor: Actor, conversationId: string) {
  const now = new Date();
  await db.conversationParticipant.updateMany({ where: { conversationId, userId: actor.id }, data: { lastReadAt: now } });
  await db.notification.updateMany({ where: { userId: actor.id, type: "NEW_MESSAGE", href: `/messages/${conversationId}`, readAt: null }, data: { readAt: now } });
}

/** Messages newer than `after` (used by the conversation view's polling). */
export async function messagesSince(actor: Actor, conversationId: string, after: Date) {
  await participantOrThrow(actor, conversationId);
  const messages = await db.message.findMany({
    where: { conversationId, createdAt: { gt: after } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, body: true, senderId: true, createdAt: true },
  });
  if (messages.some((m) => m.senderId !== actor.id)) await markConversationRead(actor, conversationId);
  return messages;
}

export async function unreadConversationCount(userId: string) {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM "ConversationParticipant" cp
    JOIN "Conversation" c ON c.id = cp."conversationId"
    WHERE cp."userId" = ${userId}
      AND EXISTS (
        SELECT 1 FROM "Message" m
        WHERE m."conversationId" = c.id AND m."senderId" <> ${userId}
          AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      )`;
  return Number(rows[0]?.n ?? 0);
}
