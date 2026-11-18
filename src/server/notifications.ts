import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import { db, type Tx } from "./db";
import { isBlockedEitherWay } from "./authz";
import type { Actor } from "./auth/types";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  href: string;
  text: string;
};

/** Types that are off by default for in-app delivery (noisy). */
const DEFAULT_OFF = new Set<NotificationType>([]);

/**
 * Creates an in-app notification, honoring per-type preferences and blocks.
 * When the user opted into email for this type, the row is marked QUEUED so a future
 * email worker can deliver it (see docs/ARCHITECTURE.md → Notifications).
 */
export async function notify(input: NotifyInput, tx: Tx = db) {
  if (input.actorId && input.actorId === input.userId) return null;
  const recipient = await tx.user.findUnique({ where: { id: input.userId }, select: { status: true } });
  if (!recipient || recipient.status !== "ACTIVE") return null;
  if (input.actorId && (await isBlockedEitherWay(input.actorId, input.userId, tx))) return null;
  const pref = await tx.notificationPreference.findUnique({
    where: { userId_type: { userId: input.userId, type: input.type } },
  });
  const inApp = pref ? pref.inApp : !DEFAULT_OFF.has(input.type);
  if (!inApp) return null;
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      href: input.href,
      text: input.text.slice(0, 280),
      emailStatus: pref?.email ? "QUEUED" : null,
    },
  });
}

export async function notifyMany(inputs: NotifyInput[], tx: Tx = db) {
  for (const i of inputs) await notify(i, tx);
}

export async function listNotifications(actor: Actor, opts: { cursor?: string; take?: number; unreadOnly?: boolean } = {}) {
  const take = opts.take ?? 30;
  const rows = await db.notification.findMany({
    where: { userId: actor.id, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true, type: true, href: true, text: true, readAt: true, createdAt: true,
      actor: { select: { username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } },
    },
  });
  return { items: rows.slice(0, take), nextCursor: rows.length > take ? rows[take - 1].id : null };
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(actor: Actor, id: string) {
  await db.notification.updateMany({ where: { id, userId: actor.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(actor: Actor) {
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } });
}

export async function getNotificationPreferences(actor: Actor) {
  const rows = await db.notificationPreference.findMany({ where: { userId: actor.id } });
  return rows;
}

export async function updateNotificationPreferences(actor: Actor, prefs: { type: NotificationType; inApp: boolean; email: boolean }[]) {
  await db.$transaction(
    prefs.map((p) =>
      db.notificationPreference.upsert({
        where: { userId_type: { userId: actor.id, type: p.type } },
        create: { userId: actor.id, type: p.type, inApp: p.inApp, email: p.email },
        update: { inApp: p.inApp, email: p.email },
      }),
    ),
  );
}
