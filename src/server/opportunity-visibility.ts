import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Conditions for an opportunity to be publicly visible (listings, search, recommendations):
 * open, deadline not passed, and its owning project/org/creator active and public.
 */
export function publicOpportunityWhere(now = new Date()): Prisma.OpportunityWhereInput {
  return {
    status: "OPEN",
    OR: [{ deadline: null }, { deadline: { gte: startOfDay(now) } }],
    AND: [
      { OR: [{ projectId: null }, { project: { status: "ACTIVE", visibility: "PUBLIC" } }] },
      { OR: [{ organizationId: null }, { organization: { status: "ACTIVE" } }] },
      { OR: [{ createdById: null }, { createdBy: { status: "ACTIVE" } }] },
    ],
  };
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Whether an opportunity can receive new applications right now. */
export function isAcceptingApplications(o: { status: string; deadline: Date | null }, now = new Date()) {
  return o.status === "OPEN" && (!o.deadline || o.deadline >= startOfDay(now));
}
