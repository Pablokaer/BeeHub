import "server-only";
import type { PartnershipStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "./db";
import { audit } from "./audit";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { assertOrgPermission, assertProjectPermission } from "./authz";
import { notify } from "./notifications";
import type { Actor } from "./auth/types";

export type EntityRef = { projectId: string } | { organizationId: string };

const refKey = (r: EntityRef) => ("projectId" in r ? `P:${r.projectId}` : `O:${r.organizationId}`);
export const pairKeyOf = (a: EntityRef, b: EntityRef) => [refKey(a), refKey(b)].sort().join("|");

async function assertCanManage(actor: Actor, ref: EntityRef, tx: Tx = db) {
  if ("projectId" in ref) await assertProjectPermission(actor, ref.projectId, "managePartnerships", tx);
  else await assertOrgPermission(actor, ref.organizationId, "managePartnerships", tx);
}

async function describe(ref: EntityRef, tx: Tx = db) {
  if ("projectId" in ref) {
    const p = await tx.project.findUnique({ where: { id: ref.projectId }, select: { name: true, slug: true, status: true, visibility: true } });
    if (!p || p.status !== "ACTIVE") return null;
    return { name: p.name, href: `/p/${p.slug}`, manageHref: `/projects/${p.slug}/manage/partners`, public: p.visibility === "PUBLIC" };
  }
  const o = await tx.organization.findUnique({ where: { id: ref.organizationId }, select: { name: true, slug: true, status: true } });
  if (!o || o.status !== "ACTIVE") return null;
  return { name: o.name, href: `/o/${o.slug}`, manageHref: `/orgs/${o.slug}/manage/partners`, public: true };
}

/** Owners and admins of an entity (recipients of partnership notifications). */
export async function entityAdmins(ref: EntityRef, tx: Tx = db): Promise<string[]> {
  if ("projectId" in ref) {
    const rows = await tx.projectMember.findMany({ where: { projectId: ref.projectId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }
  const rows = await tx.organizationMember.findMany({ where: { organizationId: ref.organizationId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

function sideColumns(side: "A" | "B", ref: EntityRef) {
  if ("projectId" in ref) return side === "A" ? { projectAId: ref.projectId, orgAId: null } : { projectBId: ref.projectId, orgBId: null };
  return side === "A" ? { orgAId: ref.organizationId, projectAId: null } : { orgBId: ref.organizationId, projectBId: null };
}

export async function requestPartnership(actor: Actor, from: EntityRef, to: EntityRef, message?: string) {
  if (refKey(from) === refKey(to)) throw new ValidationError("Choose a different project or organization.");
  await assertCanManage(actor, from);
  const [fromInfo, toInfo] = await Promise.all([describe(from), describe(to)]);
  if (!fromInfo) throw new NotFoundError("Your project or organization is not active.");
  if (!toInfo || !toInfo.public) throw new NotFoundError("That project or organization is not available.");
  const pairKey = pairKeyOf(from, to);

  const outcome = await db.$transaction(async (tx) => {
    const existing = await tx.partnership.findUnique({ where: { pairKey } });
    if (existing?.status === "ACTIVE") throw new ConflictError("You're already partners.");
    if (existing?.status === "PENDING") {
      const fromIsA = refKey(from) === (existing.projectAId ? `P:${existing.projectAId}` : `O:${existing.orgAId}`);
      if (fromIsA) throw new ConflictError("A partnership request is already pending.");
      // The other side already asked: accept it.
      await tx.partnership.update({ where: { id: existing.id }, data: { status: "ACTIVE", respondedById: actor.id, respondedAt: new Date() } });
      return { id: existing.id, accepted: true };
    }
    const data = {
      ...sideColumns("A", from),
      ...sideColumns("B", to),
      status: "PENDING" as const,
      message: message ?? null,
      requestedById: actor.id,
      respondedById: null,
      respondedAt: null,
      endedAt: null,
      createdAt: new Date(),
    };
    const row = existing
      ? await tx.partnership.update({ where: { id: existing.id }, data })
      : await tx.partnership.create({ data: { pairKey, ...data } });
    return { id: row.id, accepted: false };
  });

  const recipients = await entityAdmins(to);
  for (const userId of recipients) {
    await notify({
      userId,
      type: outcome.accepted ? "PARTNERSHIP_ACCEPTED" : "PARTNERSHIP_REQUEST",
      actorId: actor.id,
      href: toInfo.manageHref,
      text: outcome.accepted
        ? `${fromInfo.name} and ${toInfo.name} are now partners.`
        : `${fromInfo.name} wants to partner with ${toInfo.name}.`,
    });
  }
  await audit({ actorId: actor.id, action: outcome.accepted ? "partnership.accepted" : "partnership.requested", entityType: "Partnership", entityId: outcome.id });
  return outcome;
}

function sides(p: { projectAId: string | null; orgAId: string | null; projectBId: string | null; orgBId: string | null }) {
  const a: EntityRef = p.projectAId ? { projectId: p.projectAId } : { organizationId: p.orgAId! };
  const b: EntityRef = p.projectBId ? { projectId: p.projectBId } : { organizationId: p.orgBId! };
  return { a, b };
}

export async function respondToPartnership(actor: Actor, partnershipId: string, accept: boolean) {
  const p = await db.partnership.findUnique({ where: { id: partnershipId } });
  if (!p || p.status !== "PENDING") throw new NotFoundError("This request is no longer available.");
  const { a, b } = sides(p);
  await assertCanManage(actor, b);
  await db.partnership.update({
    where: { id: p.id },
    data: { status: accept ? "ACTIVE" : "DECLINED", respondedById: actor.id, respondedAt: new Date() },
  });
  if (accept) {
    const [aInfo, bInfo] = await Promise.all([describe(a), describe(b)]);
    for (const userId of await entityAdmins(a)) {
      await notify({
        userId, type: "PARTNERSHIP_ACCEPTED", actorId: actor.id, href: bInfo?.href ?? "/",
        text: `${bInfo?.name ?? "A partner"} accepted the partnership with ${aInfo?.name ?? "your team"}.`,
      });
    }
  }
  await audit({ actorId: actor.id, action: accept ? "partnership.accepted" : "partnership.declined", entityType: "Partnership", entityId: p.id });
}

export async function cancelPartnershipRequest(actor: Actor, partnershipId: string) {
  const p = await db.partnership.findUnique({ where: { id: partnershipId } });
  if (!p || p.status !== "PENDING") throw new NotFoundError("This request is no longer available.");
  await assertCanManage(actor, sides(p).a);
  await db.partnership.update({ where: { id: p.id }, data: { status: "CANCELED" } });
}

export async function endPartnership(actor: Actor, partnershipId: string) {
  const p = await db.partnership.findUnique({ where: { id: partnershipId } });
  if (!p || p.status !== "ACTIVE") throw new NotFoundError("This partnership is not active.");
  const { a, b } = sides(p);
  const canA = await assertCanManage(actor, a).then(() => true, () => false);
  const canB = canA ? false : await assertCanManage(actor, b).then(() => true, () => false);
  if (!canA && !canB) throw new NotFoundError("This partnership is not available.");
  await db.partnership.update({ where: { id: p.id }, data: { status: "ENDED", endedAt: new Date() } });
  await audit({ actorId: actor.id, action: "partnership.ended", entityType: "Partnership", entityId: p.id });
}

const entitySelect = {
  projectA: { select: { id: true, slug: true, name: true, logoKey: true, summary: true, status: true, visibility: true } },
  projectB: { select: { id: true, slug: true, name: true, logoKey: true, summary: true, status: true, visibility: true } },
  orgA: { select: { id: true, slug: true, name: true, logoKey: true, tagline: true, status: true } },
  orgB: { select: { id: true, slug: true, name: true, logoKey: true, tagline: true, status: true } },
} as const;

export type PartnerEntity = { kind: "project" | "org"; id: string; slug: string; name: string; logoKey: string | null; summary: string | null; href: string };

/** Partnerships involving an entity, each returned with "the other side" resolved. */
export async function partnershipsFor(ref: EntityRef, status?: PartnershipStatus | PartnershipStatus[]) {
  const where =
    "projectId" in ref
      ? { OR: [{ projectAId: ref.projectId }, { projectBId: ref.projectId }] }
      : { OR: [{ orgAId: ref.organizationId }, { orgBId: ref.organizationId }] };
  const statusFilter = status ? { status: Array.isArray(status) ? { in: status } : status } : {};
  const rows = await db.partnership.findMany({
    where: { ...where, ...statusFilter },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, message: true, createdAt: true, respondedAt: true, projectAId: true, orgAId: true, ...entitySelect },
  });
  const me = refKey(ref);
  const out: { id: string; status: PartnershipStatus; message: string | null; createdAt: Date; direction: "outgoing" | "incoming"; other: PartnerEntity }[] = [];
  for (const r of rows) {
    const aKey = r.projectAId ? `P:${r.projectAId}` : `O:${r.orgAId}`;
    const iAmA = aKey === me;
    const otherProject = iAmA ? r.projectB : r.projectA;
    const otherOrg = iAmA ? r.orgB : r.orgA;
    let other: PartnerEntity | null = null;
    if (otherProject && otherProject.status === "ACTIVE" && otherProject.visibility === "PUBLIC") {
      other = { kind: "project", id: otherProject.id, slug: otherProject.slug, name: otherProject.name, logoKey: otherProject.logoKey, summary: otherProject.summary, href: `/p/${otherProject.slug}` };
    } else if (otherOrg && otherOrg.status === "ACTIVE") {
      other = { kind: "org", id: otherOrg.id, slug: otherOrg.slug, name: otherOrg.name, logoKey: otherOrg.logoKey, summary: otherOrg.tagline, href: `/o/${otherOrg.slug}` };
    }
    if (!other) continue;
    out.push({ id: r.id, status: r.status, message: r.message, createdAt: r.createdAt, direction: iAmA ? "outgoing" : "incoming", other });
  }
  return out;
}
