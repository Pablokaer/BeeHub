import "server-only";
import type { ReportReason, ReportStatus, ReportTarget } from "@/generated/prisma/enums";
import { db } from "./db";
import { audit } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { rateLimit } from "./security/rate-limit";
import { isStaff, type Actor } from "./auth/types";

async function targetExists(type: ReportTarget, id: string) {
  switch (type) {
    case "USER": return !!(await db.user.findUnique({ where: { id }, select: { id: true } }));
    case "POST": return !!(await db.post.findUnique({ where: { id }, select: { id: true } }));
    case "COMMENT": return !!(await db.comment.findUnique({ where: { id }, select: { id: true } }));
    case "PROJECT": return !!(await db.project.findUnique({ where: { id }, select: { id: true } }));
    case "ORGANIZATION": return !!(await db.organization.findUnique({ where: { id }, select: { id: true } }));
    case "OPPORTUNITY": return !!(await db.opportunity.findUnique({ where: { id }, select: { id: true } }));
    case "MESSAGE": return !!(await db.message.findUnique({ where: { id }, select: { id: true } }));
  }
}

export async function fileReport(actor: Actor, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }) {
  await rateLimit("report", actor.id);
  if (!(await targetExists(input.targetType, input.targetId))) throw new NotFoundError("We couldn't find what you're reporting.");
  if (input.targetType === "USER" && input.targetId === actor.id) throw new ValidationError("You can't report yourself.");
  if (input.targetType === "MESSAGE") {
    // Only participants may report a private message (which then becomes visible to moderators).
    const m = await db.message.findUnique({ where: { id: input.targetId }, select: { conversation: { select: { participants: { select: { userId: true } } } } } });
    if (!m?.conversation.participants.some((p) => p.userId === actor.id)) throw new NotFoundError("We couldn't find what you're reporting.");
  }
  const open = await db.report.findFirst({ where: { reporterId: actor.id, targetType: input.targetType, targetId: input.targetId, status: "OPEN" } });
  if (open) throw new ConflictError("You've already reported this. Our moderators will review it.");
  const r = await db.report.create({ data: { reporterId: actor.id, ...input, details: input.details ?? null } });
  await audit({ actorId: actor.id, action: "report.filed", entityType: "Report", entityId: r.id, metadata: { targetType: input.targetType, targetId: input.targetId, reason: input.reason } });
  return r;
}

function assertStaff(actor: Actor) {
  if (!isStaff(actor)) throw new ForbiddenError();
}

/** Loads a short preview of each reported item for the moderation queue. */
async function preview(type: ReportTarget, id: string): Promise<{ title: string; body: string | null; href: string | null; status: string }> {
  switch (type) {
    case "USER": {
      const u = await db.user.findUnique({ where: { id }, select: { username: true, status: true, profile: { select: { displayName: true, headline: true, bio: true } } } });
      return { title: u?.profile?.displayName ?? u?.username ?? "Deleted user", body: u?.profile?.bio ?? u?.profile?.headline ?? null, href: u ? `/u/${u.username}` : null, status: u?.status ?? "DELETED" };
    }
    case "POST": {
      const p = await db.post.findUnique({ where: { id }, select: { body: true, status: true, author: { select: { username: true } } } });
      return { title: `Post by @${p?.author.username ?? "unknown"}`, body: p?.body ?? null, href: `/posts/${id}`, status: p?.status ?? "DELETED" };
    }
    case "COMMENT": {
      const c = await db.comment.findUnique({ where: { id }, select: { body: true, status: true, postId: true, author: { select: { username: true } } } });
      return { title: `Comment by @${c?.author.username ?? "unknown"}`, body: c?.body ?? null, href: c ? `/posts/${c.postId}#c-${id}` : null, status: c?.status ?? "DELETED" };
    }
    case "PROJECT": {
      const p = await db.project.findUnique({ where: { id }, select: { name: true, summary: true, slug: true, status: true } });
      return { title: p?.name ?? "Deleted project", body: p?.summary ?? null, href: p ? `/p/${p.slug}` : null, status: p?.status ?? "DELETED" };
    }
    case "ORGANIZATION": {
      const o = await db.organization.findUnique({ where: { id }, select: { name: true, tagline: true, slug: true, status: true } });
      return { title: o?.name ?? "Deleted organization", body: o?.tagline ?? null, href: o ? `/o/${o.slug}` : null, status: o?.status ?? "DELETED" };
    }
    case "OPPORTUNITY": {
      const o = await db.opportunity.findUnique({ where: { id }, select: { title: true, description: true, status: true } });
      return { title: o?.title ?? "Deleted opportunity", body: o?.description?.slice(0, 400) ?? null, href: `/opportunities/${id}`, status: o?.status ?? "DELETED" };
    }
    case "MESSAGE": {
      const m = await db.message.findUnique({ where: { id }, select: { body: true, sender: { select: { username: true } } } });
      return { title: `Message from @${m?.sender.username ?? "unknown"}`, body: m?.body ?? null, href: null, status: m ? "PUBLISHED" : "DELETED" };
    }
  }
}

export async function listReports(actor: Actor, status: ReportStatus = "OPEN") {
  assertStaff(actor);
  const reports = await db.report.findMany({
    where: { status },
    orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
    take: 100,
    include: {
      reporter: { select: { username: true } },
      resolvedBy: { select: { username: true } },
    },
  });
  return Promise.all(reports.map(async (r) => ({ ...r, target: await preview(r.targetType, r.targetId) })));
}

export type ModerationAction = "dismiss" | "remove_content" | "suspend_user" | "restore";

/** Applies a moderation decision; the reported content becomes inaccessible publicly. */
export async function resolveReport(actor: Actor, reportId: string, action: ModerationAction, note?: string) {
  assertStaff(actor);
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r) throw new NotFoundError();
  if (action !== "dismiss") await applyAction(actor, r.targetType, r.targetId, action);
  await db.report.updateMany({
    where: { targetType: r.targetType, targetId: r.targetId, status: "OPEN" },
    data: { status: action === "dismiss" ? "DISMISSED" : "ACTIONED", resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: note ?? null },
  });
  await audit({ actorId: actor.id, action: `moderation.${action}`, entityType: r.targetType, entityId: r.targetId, metadata: { reportId, note: note ?? null } });
}

async function applyAction(actor: Actor, type: ReportTarget, id: string, action: ModerationAction) {
  const restore = action === "restore";
  switch (type) {
    case "POST":
      await db.post.updateMany({ where: { id, status: { not: "DELETED" } }, data: { status: restore ? "PUBLISHED" : "REMOVED" } });
      return;
    case "COMMENT":
      await db.comment.updateMany({ where: { id, status: { not: "DELETED" } }, data: { status: restore ? "PUBLISHED" : "REMOVED" } });
      return;
    case "PROJECT":
      await db.project.update({ where: { id }, data: { status: restore ? "ACTIVE" : "REMOVED" } });
      if (!restore) await db.opportunity.updateMany({ where: { projectId: id, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
      return;
    case "ORGANIZATION":
      await db.organization.update({ where: { id }, data: { status: restore ? "ACTIVE" : "REMOVED" } });
      return;
    case "OPPORTUNITY":
      await db.opportunity.update({ where: { id }, data: { status: restore ? "CLOSED" : "REMOVED" } });
      return;
    case "MESSAGE":
      if (!restore) await db.message.delete({ where: { id } }).catch(() => undefined);
      return;
    case "USER":
      await setUserSuspended(actor, id, !restore);
      return;
  }
}

export async function setUserSuspended(actor: Actor, userId: string, suspended: boolean) {
  assertStaff(actor);
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (!target || target.status === "DELETED") throw new NotFoundError();
  if (target.role === "ADMIN" || (target.role === "MODERATOR" && actor.role !== "ADMIN")) throw new ForbiddenError("You can't suspend this account.");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } }),
    ...(suspended ? [db.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit({ actorId: actor.id, action: suspended ? "moderation.user_suspended" : "moderation.user_restored", entityType: "User", entityId: userId });
}

export async function listAuditLog(actor: Actor, take = 100) {
  assertStaff(actor);
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { username: true } } } });
}

export async function moderationStats(actor: Actor) {
  assertStaff(actor);
  const [open, users, posts, projects] = await Promise.all([
    db.report.count({ where: { status: "OPEN" } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.post.count({ where: { status: "PUBLISHED" } }),
    db.project.count({ where: { status: "ACTIVE" } }),
  ]);
  return { open, users, posts, projects };
}
