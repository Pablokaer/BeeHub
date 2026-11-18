import "server-only";
import type { z } from "zod";
import type { OpportunityStatus } from "@/generated/prisma/enums";
import type { opportunitySchema } from "@/lib/validation";
import { collaborationLabels } from "@/lib/constants";
import { db, type Tx } from "./db";
import { audit } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { assertOrgPermission, assertProjectPermission, getOrgRole, getProjectRole, hasRank, resolveActingAs, isBlockedEitherWay } from "./authz";
import { setOpportunityTags } from "./tags";
import { explainMatch, notifyMatchingMembers } from "./matching";
import { logger } from "./logger";
import { opportunityCardSelect } from "./selects";
import { isAcceptingApplications, publicOpportunityWhere } from "./opportunity-visibility";
import { isStaff, type Actor, type Viewer } from "./auth/types";

const PAID_COMPENSATION = new Set(["HOURLY", "FIXED", "SALARY", "STIPEND"]);
const PAID_COLLABS = new Set(["PAID", "FREELANCE"]);

type OpportunityInput = z.infer<typeof opportunitySchema>;

function fields(input: OpportunityInput) {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    collaborationType: input.collaborationType,
    workMode: input.workMode,
    location: input.workMode === "REMOTE" ? input.location ?? null : input.location ?? null,
    experienceLevel: input.experienceLevel ?? null,
    duration: input.duration ?? null,
    commitment: input.commitment ?? null,
    compensationType: input.compensationType,
    compensation: input.compensation ?? null,
    isPaid: PAID_COMPENSATION.has(input.compensationType) || PAID_COLLABS.has(input.collaborationType),
    deadline: input.deadline ?? null,
  };
}

type OpportunityOwnerRef = { id: string; projectId: string | null; organizationId: string | null; createdById: string | null };

/** Whether the actor can edit the opportunity and review its applications. */
export async function canManageOpportunity(actor: Pick<Actor, "id"> | null, o: OpportunityOwnerRef, tx: Tx = db) {
  if (!actor) return false;
  if (o.projectId) return hasRank(await getProjectRole(actor.id, o.projectId, tx), "EDITOR");
  if (o.organizationId) return hasRank(await getOrgRole(actor.id, o.organizationId, tx), "EDITOR");
  return o.createdById === actor.id;
}

export async function assertCanManageOpportunity(actor: Actor, opportunityId: string, tx: Tx = db) {
  const o = await tx.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true, projectId: true, organizationId: true, createdById: true, status: true } });
  if (!o || o.status === "REMOVED") throw new NotFoundError("Opportunity not found.");
  if (!(await canManageOpportunity(actor, o, tx))) throw new ForbiddenError();
  return o;
}

/** Owners of an opportunity who should hear about applications. */
export async function opportunityManagers(o: OpportunityOwnerRef, tx: Tx = db): Promise<string[]> {
  if (o.projectId) {
    const rows = await tx.projectMember.findMany({ where: { projectId: o.projectId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }
  if (o.organizationId) {
    const rows = await tx.organizationMember.findMany({ where: { organizationId: o.organizationId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }
  return o.createdById ? [o.createdById] : [];
}

export async function createOpportunity(actor: Actor, input: OpportunityInput, opts: { announce?: boolean } = {}) {
  const owner = await resolveActingAs(actor, input.owner);
  const status: OpportunityStatus = input.publish ? "OPEN" : "DRAFT";
  if (owner.kind === "project" && status === "OPEN") {
    const p = await db.project.findUniqueOrThrow({ where: { id: owner.projectId }, select: { visibility: true } });
    if (p.visibility === "PRIVATE") throw new ValidationError("Make the project public before publishing opportunities for it, or save this as a draft.");
  }
  if (input.deadline && input.deadline < new Date(Date.now() - 86400000)) throw new ValidationError(undefined, { deadline: "The deadline must be in the future" });

  const opp = await db.$transaction(async (tx) => {
    const o = await tx.opportunity.create({
      data: {
        ...fields(input),
        status,
        publishedAt: status === "OPEN" ? new Date() : null,
        createdById: actor.id,
        projectId: owner.kind === "project" ? owner.projectId : null,
        organizationId: owner.kind === "org" ? owner.organizationId : null,
      },
    });
    await setOpportunityTags(o.id, "SKILL", input.skills, tx);
    await setOpportunityTags(o.id, "TOPIC", input.topics, tx);
    return o;
  });
  await audit({ actorId: actor.id, action: "opportunity.created", entityType: "Opportunity", entityId: opp.id, metadata: { status } });
  if (status === "OPEN") await afterPublish(actor, opp.id, opts.announce ?? true);
  return opp;
}

async function afterPublish(actor: Actor, opportunityId: string, announce: boolean) {
  const o = await db.opportunity.findUniqueOrThrow({ where: { id: opportunityId }, select: { title: true, collaborationType: true, projectId: true, organizationId: true } });
  if (announce) {
    await db.post.create({
      data: {
        authorId: actor.id,
        projectId: o.projectId,
        organizationId: o.organizationId,
        type: "OPPORTUNITY",
        opportunityId,
        body: `Looking for: ${o.title} · ${collaborationLabels[o.collaborationType]}`,
      },
    });
  }
  try {
    await notifyMatchingMembers(opportunityId, actor.id);
  } catch (err) {
    // Matching notifications are best-effort and must never block publishing.
    logger.error("matching.notify_failed", { err, opportunityId });
  }
}

export async function updateOpportunity(actor: Actor, opportunityId: string, input: OpportunityInput) {
  const o = await assertCanManageOpportunity(actor, opportunityId);
  const wasPublished = o.status !== "DRAFT";
  const publishNow = !wasPublished && input.publish;
  if (publishNow && o.projectId) {
    const p = await db.project.findUniqueOrThrow({ where: { id: o.projectId }, select: { visibility: true } });
    if (p.visibility === "PRIVATE") throw new ValidationError("Make the project public before publishing opportunities for it.");
  }
  await db.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: { ...fields(input), ...(publishNow ? { status: "OPEN", publishedAt: new Date() } : {}) },
    });
    await setOpportunityTags(opportunityId, "SKILL", input.skills, tx);
    await setOpportunityTags(opportunityId, "TOPIC", input.topics, tx);
  });
  await audit({ actorId: actor.id, action: "opportunity.updated", entityType: "Opportunity", entityId: opportunityId });
  if (publishNow) await afterPublish(actor, opportunityId, true);
}

const ALLOWED_STATUS: Record<OpportunityStatus, OpportunityStatus[]> = {
  DRAFT: ["OPEN", "ARCHIVED"],
  OPEN: ["CLOSED", "FILLED", "ARCHIVED"],
  CLOSED: ["OPEN", "FILLED", "ARCHIVED"],
  FILLED: ["OPEN", "CLOSED", "ARCHIVED"],
  ARCHIVED: ["CLOSED"],
  REMOVED: [],
};

/** Close, reopen, mark filled or archive. Archiving keeps the opportunity and all applications. */
export async function setOpportunityStatus(actor: Actor, opportunityId: string, status: OpportunityStatus) {
  const o = await assertCanManageOpportunity(actor, opportunityId);
  if (!ALLOWED_STATUS[o.status].includes(status)) throw new ValidationError(`This opportunity can't be moved from ${o.status.toLowerCase()} to ${status.toLowerCase()}.`);
  if (status === "OPEN" && o.projectId) {
    const p = await db.project.findUniqueOrThrow({ where: { id: o.projectId }, select: { visibility: true, status: true } });
    if (p.visibility === "PRIVATE" || p.status !== "ACTIVE") throw new ValidationError("The project must be public and active to reopen this opportunity.");
  }
  const firstPublish = o.status === "DRAFT" && status === "OPEN";
  await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      status,
      ...(status === "OPEN" ? { closedAt: null, ...(firstPublish ? { publishedAt: new Date() } : {}) } : {}),
      ...(status === "CLOSED" || status === "FILLED" ? { closedAt: new Date() } : {}),
    },
  });
  await audit({ actorId: actor.id, action: "opportunity.status_changed", entityType: "Opportunity", entityId: opportunityId, metadata: { from: o.status, to: status } });
  if (firstPublish) await afterPublish(actor, opportunityId, true);
}

/** Detail view. Non-managers only see published opportunities of visible owners. */
export async function getOpportunity(viewer: Viewer | null, opportunityId: string) {
  const o = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      ...opportunityCardSelect,
      description: true,
      duration: true,
      commitment: true,
      projectId: true,
      organizationId: true,
      createdById: true,
      filledById: true,
      project: { select: { id: true, slug: true, name: true, logoKey: true, summary: true, stage: true, visibility: true, status: true } },
      organization: { select: { id: true, slug: true, name: true, logoKey: true, tagline: true, status: true } },
      createdBy: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } },
    },
  });
  if (!o || o.status === "REMOVED") return null;
  const canManage = await canManageOpportunity(viewer, o);
  if (!canManage && !isStaff(viewer)) {
    if (o.status === "DRAFT") return null;
    if (o.project && (o.project.visibility !== "PUBLIC" || o.project.status !== "ACTIVE")) return null;
    if (o.organization && o.organization.status !== "ACTIVE") return null;
    if (o.createdBy && o.createdBy.status !== "ACTIVE" && !o.project && !o.organization) return null;
    if (viewer && o.createdById && (await isBlockedEitherWay(viewer.id, o.createdById))) return null;
  }
  const [myApplication, match] = await Promise.all([
    viewer ? db.application.findUnique({ where: { opportunityId_applicantId: { opportunityId, applicantId: viewer.id } }, select: { id: true, status: true, createdAt: true } }) : null,
    viewer && !canManage ? explainMatch(viewer.id, opportunityId) : null,
  ]);
  return { opportunity: o, canManage, accepting: isAcceptingApplications(o), myApplication, match };
}

/** Opportunities the actor can manage: personal ones plus those of projects/orgs where they're editor+. */
export async function listManagedOpportunities(actor: Actor, opts: { status?: OpportunityStatus | "ALL" } = {}) {
  const [projects, orgs] = await Promise.all([
    db.projectMember.findMany({ where: { userId: actor.id, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { projectId: true } }),
    db.organizationMember.findMany({ where: { userId: actor.id, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, select: { organizationId: true } }),
  ]);
  // Projects owned by orgs where the actor is admin/editor also count.
  const orgProjects = orgs.length
    ? await db.project.findMany({ where: { organizationId: { in: orgs.map((o) => o.organizationId) } }, select: { id: true } })
    : [];
  const projectIds = [...new Set([...projects.map((p) => p.projectId), ...orgProjects.map((p) => p.id)])];
  const status = opts.status && opts.status !== "ALL" ? { status: opts.status } : { status: { not: "REMOVED" as const } };
  return db.opportunity.findMany({
    where: {
      ...status,
      OR: [
        { projectId: null, organizationId: null, createdById: actor.id },
        { projectId: { in: projectIds } },
        { organizationId: { in: orgs.map((o) => o.organizationId) } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      ...opportunityCardSelect,
      _count: { select: { applications: { where: { status: { not: "WITHDRAWN" } } } } },
    },
  });
}

export async function getOpportunityForEdit(actor: Actor, opportunityId: string) {
  await assertCanManageOpportunity(actor, opportunityId);
  return db.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { tags: { select: { kind: true, tag: { select: { name: true } } } }, project: { select: { name: true } }, organization: { select: { name: true } } },
  });
}

export async function latestOpportunities(take = 6) {
  return db.opportunity.findMany({ where: publicOpportunityWhere(), orderBy: { publishedAt: "desc" }, take, select: opportunityCardSelect });
}

export { assertOrgPermission, assertProjectPermission };
