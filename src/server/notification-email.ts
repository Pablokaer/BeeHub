import "server-only";
import { siteConfig } from "@/lib/constants";
import { db } from "./db";
import { env } from "./env";
import { sendEmail } from "./mail/mailer";
import { logger } from "./logger";

/**
 * Delivers notifications that users opted to receive by email (status QUEUED), as one
 * summary email per user. Run periodically: `npm run notifications:email` or
 * POST /api/cron/notification-emails with the CRON_SECRET bearer token.
 */
export async function deliverQueuedNotificationEmails(limitUsers = 200) {
  const pending = await db.notification.findMany({
    where: { emailStatus: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 5000,
    select: { id: true, userId: true, text: true, href: true, createdAt: true },
  });
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    if (!byUser.has(n.userId) && byUser.size >= limitUsers) continue;
    (byUser.get(n.userId) ?? byUser.set(n.userId, []).get(n.userId)!).push(n);
  }
  let sent = 0;
  for (const [userId, items] of byUser) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, status: true, emailVerifiedAt: true, profile: { select: { displayName: true } } } });
    const ids = items.map((i) => i.id);
    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      await db.notification.updateMany({ where: { id: { in: ids } }, data: { emailStatus: null } });
      continue;
    }
    const lines = items.slice(0, 20).map((i) => `• ${i.text}\n  ${new URL(i.href, env().APP_URL).toString()}`);
    const more = items.length > 20 ? `\n…and ${items.length - 20} more.` : "";
    await sendEmail({
      to: user.email,
      subject: `${items.length} new update${items.length === 1 ? "" : "s"} on ${siteConfig.name}`,
      text: `Hi ${user.profile?.displayName ?? "there"},\n\n${lines.join("\n\n")}${more}\n\nManage email notifications: ${new URL("/settings/notifications", env().APP_URL)}\n`,
      kind: "notification-digest",
    });
    await db.notification.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "SENT" } });
    sent++;
  }
  logger.info("notifications.email_digest", { users: sent });
  return { users: sent, notifications: pending.length };
}
