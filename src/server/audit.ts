import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "./db";
import { logger } from "./logger";

export type AuditEntry = {
  actorId?: string | null;
  action: string; // e.g. "auth.login", "project.member.removed", "moderation.post.removed"
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Records an important administrative/security event (also emitted as a structured log line). */
export async function audit(entry: AuditEntry, tx: Tx = db) {
  logger.info("audit", { ...entry });
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    },
  });
}
