import "server-only";
import type { z } from "zod";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { applicationSchema } from "@/lib/validation";
import { applicationStatusLabels } from "@/lib/constants";
import { db } from "./db";
import { audit } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { assertOrgPermission, isBlockedEitherWay } from "./authz";
import { notify } from "./notifications";
import { rateLimit } from "./security/rate-limit";
import { canManageOpportunity, opportunityManagers } from "./opportunities";
import { isAcceptingApplications } from "./opportunity-visibility";
import { userCardSelect } from "./selects";
import type { Actor } from "./auth/types";

/** Allowed transitions for the opportunity owner. WITHDRAWN is set only by the applicant. */
export const STATUS_FLOW: Record<ApplicationStatus, ApplicationStatus[]> = {
  RECEIVED: ["IN_REVIEW", "CONTACTED", "ACCEPTED", "REJECTED"],
  IN_REVIEW: ["CONTACTED", "ACCEPTED", "REJECTED"],
  CONTACTED: ["IN_REVIEW", "ACCEPTED", "REJECTED"],
  ACCEPTED: ["REJECTED"],
  REJECTED: ["IN_REVIEW"],
  WITHDRAWN: [],
};

export async function applyToOpportunity(actor: Actor, input: z.infer<typeof applicationSchema>) {
  const o = await db.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: {
      id: true, title: true, status: true, deadline: true, projectId: true, organizationId: true, createdById: true,
      project: { select: { visibility: true, status: true } },
      organization: { select: { status: true } },
    },
  });
  if (!o || o.status === "REMOVED" || o.status === "DRAFT") throw new NotFoundError("Opportunity not found.");
  if (o.project && (o.project.visibility !== "PUBLIC" || o.project.status !== "ACTIVE")) throw new NotFoundError("Opportunity not found.");
  if (!isAcceptingApplications(o)) throw new ValidationError("This opportunity is no longer accepting applications.");
  if (await canManageOpportunity(actor, o)) throw new ValidationError("You manage this opportunity, so you can't apply to it.");
  if (o.createdById && (await isBlockedEitherWay(actor.id, o.createdById))) throw new NotFoundError("Opportunity not found.");
  if (input.organizationId) await assertOrgPermission(actor, input.organizationId, "publish");
  await rateLimit("application", actor.id);

  const existing = await db.application.findUnique({ where: { opportunityId_applicantId: { opportunityId: o.id, applicantId: actor.id } } });
  if (existing && existing.status !== "WITHDRAWN") throw new ConflictError("You've already applied to this opportunity.");

  let applicationId: string;
  try {
    applicationId = await db.$transaction(async (tx) => {
      const data = { message: input.message, portfolioUrl: input.portfolioUrl ?? null, organizationId: input.organizationId ?? null, status: "RECEIVED" as const };
      const app = existing
        ? await tx.application.update({ where: { id: existing.id }, data })
        : await tx.application.create({ data: { ...data, opportunityId: o.id, applicantId: actor.id } });
      await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: actor.id, fromStatus: existing?.status ?? null, toStatus: "RECEIVED" } });
      return app.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("You've already applied to this opportunity.");
    throw e;
  }

  const [me, org] = await Promise.all([
    db.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } }),
    input.organizationId ? db.organization.findUnique({ where: { id: input.organizationId }, select: { name: true } }) : null,
  ]);
  const who = org ? `${org.name} (via ${me?.displayName ?? "a member"})` : me?.displayName ?? "Someone";
  for (const userId of await opportunityManagers(o)) {
    await notify({ userId, type: "APPLICATION_RECEIVED", actorId: actor.id, href: `/applications/received?opportunity=${o.id}`, text: `${who} applied to “${o.title}”.` });
  }
  await audit({ actorId: actor.id, action: "application.submitted", entityType: "Application", entityId: applicationId, metadata: { opportunityId: o.id } });
  return { id: applicationId };
}

export async function withdrawApplication(actor: Actor, applicationId: string) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app || app.applicantId !== actor.id) throw new NotFoundError("Application not found.");
  if (app.status === "WITHDRAWN") return;
  if (app.status === "ACCEPTED" || app.status === "REJECTED") throw new ValidationError("This application has already been decided.");
  await db.$transaction([
    db.application.update({ where: { id: app.id }, data: { status: "WITHDRAWN" } }),
    db.applicationEvent.create({ data: { applicationId: app.id, actorId: actor.id, fromStatus: app.status, toStatus: "WITHDRAWN" } }),
  ]);
}

export async function updateApplicationStatus(
  actor: Actor,
  applicationId: string,
  status: ApplicationStatus,
  opts: { note?: string; addToTeam?: boolean; markFilled?: boolean } = {},
) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { opportunity: { select: { id: true, title: true, projectId: true, organizationId: true, createdById: true, status: true, project: { select: { name: true, slug: true } } } } },
  });
  if (!app) throw new NotFoundError("Application not found.");
  if (!(await canManageOpportunity(actor, app.opportunity))) throw new ForbiddenError();
  if (!STATUS_FLOW[app.status].includes(status)) {
    throw new ValidationError(`An application that is “${applicationStatusLabels[app.status]}” can't be changed to “${applicationStatusLabels[status]}”.`);
  }
  const o = app.opportunity;
  await db.$transaction(async (tx) => {
    await tx.application.update({ where: { id: app.id }, data: { status } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: actor.id, fromStatus: app.status, toStatus: status, note: opts.note ?? null } });
    if (status === "ACCEPTED" && o.projectId && opts.addToTeam !== false) {
      // Associate the new collaborator with the opportunity they filled.
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: o.projectId, userId: app.applicantId } },
        create: { projectId: o.projectId, userId: app.applicantId, role: "MEMBER", title: o.title.slice(0, 80), opportunityId: o.id },
        update: { opportunityId: o.id },
      });
    }
    if (status === "ACCEPTED" && opts.markFilled) {
      await tx.opportunity.update({ where: { id: o.id }, data: { status: "FILLED", filledById: app.applicantId, closedAt: new Date() } });
    }
  });
  await notify({
    userId: app.applicantId,
    type: "APPLICATION_STATUS",
    actorId: actor.id,
    href: "/applications",
    text:
      status === "ACCEPTED"
        ? `Your application to “${o.title}” was accepted${o.project ? ` — welcome to ${o.project.name}!` : "."}`
        : `Your application to “${o.title}” is now: ${applicationStatusLabels[status]}.`,
  });
  await audit({ actorId: actor.id, action: "application.status_changed", entityType: "Application", entityId: app.id, metadata: { from: app.status, to: status } });
}

const ownerSelect = {
  project: { select: { slug: true, name: true, logoKey: true } },
  organization: { select: { slug: true, name: true, logoKey: true } },
  createdBy: { select: { username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } },
} as const;

export async function listSentApplications(actor: Actor) {
  return db.application.findMany({
    where: { applicantId: actor.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, status: true, message: true, createdAt: true, updatedAt: true,
      organization: { select: { name: true, slug: true } },
      opportunity: { select: { id: true, title: true, status: true, collaborationType: true, ...ownerSelect } },
      events: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } },
    },
  });
}

/** Applications for every opportunity the actor manages (optionally filtered). */
export async function listReceivedApplications(actor: Actor, filter: { opportunityId?: string; status?: ApplicationStatus } = {}) {
  const [projects, orgs] = await Promise.all([
    db.projectMember.findMany({ where: { userId: actor.id, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { projectId: true } }),
    db.organizationMember.findMany({ where: { userId: actor.id, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { organizationId: true } }),
  ]);
  const orgIds = orgs.map((o) => o.organizationId);
  const orgProjects = orgIds.length ? await db.project.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }) : [];
  const projectIds = [...new Set([...projects.map((p) => p.projectId), ...orgProjects.map((p) => p.id)])];
  return db.application.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : { status: { not: "WITHDRAWN" } }),
      ...(filter.opportunityId ? { opportunityId: filter.opportunityId } : {}),
      opportunity: {
        OR: [
          { projectId: null, organizationId: null, createdById: actor.id },
          { projectId: { in: projectIds } },
          { organizationId: { in: orgIds } },
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, status: true, message: true, portfolioUrl: true, createdAt: true, updatedAt: true,
      applicant: { select: { ...userCardSelect, skills: { where: { kind: "SKILL" }, take: 8, select: { tag: { select: { slug: true, name: true } } } } } },
      organization: { select: { name: true, slug: true, logoKey: true } },
      opportunity: { select: { id: true, title: true, projectId: true, status: true, ...ownerSelect } },
      events: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, note: true, createdAt: true, actor: { select: { profile: { select: { displayName: true } } } } } },
    },
  });
}

/** True when the two users are linked through an application (either direction). */
export async function haveApplicationRelation(a: string, b: string) {
  const n = await db.application.count({
    where: {
      OR: [
        { applicantId: a, opportunity: { OR: [{ createdById: b }, { project: { members: { some: { userId: b, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } }, { organization: { members: { some: { userId: b, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } }] } },
        { applicantId: b, opportunity: { OR: [{ createdById: a }, { project: { members: { some: { userId: a, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } }, { organization: { members: { some: { userId: a, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } }] } },
      ],
    },
  });
  return n > 0;
}
