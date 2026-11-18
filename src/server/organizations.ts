import "server-only";
import type { z } from "zod";
import type { MemberRole } from "@/generated/prisma/enums";
import type { organizationSchema } from "@/lib/validation";
import { db } from "./db";
import { audit } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { assertOrgPermission, canManageMember, getOrgRole } from "./authz";
import { assertHandleAvailable } from "./handles";
import { setOrganizationTags } from "./tags";
import { assertOwnedMedia } from "./uploads";
import { followerCount, getFollowStatus } from "./social/graph";
import { partnershipsFor } from "./partnerships";
import { isStaff, type Actor, type Viewer } from "./auth/types";
import { opportunityCardSelect } from "./selects";

export async function createOrganization(actor: Actor, input: z.infer<typeof organizationSchema>) {
  await assertHandleAvailable(input.slug, "slug");
  await assertOwnedMedia(actor, [input.logoKey, input.coverKey]);
  try {
    const org = await db.$transaction(async (tx) => {
      const o = await tx.organization.create({
        data: {
          slug: input.slug,
          name: input.name,
          type: input.type,
          tagline: input.tagline ?? null,
          description: input.description ?? null,
          industry: input.industry ?? null,
          website: input.website ?? null,
          location: input.location ?? null,
          size: input.size ?? null,
          logoKey: input.logoKey ?? null,
          coverKey: input.coverKey ?? null,
          createdById: actor.id,
          members: { create: { userId: actor.id, role: "OWNER" } },
        },
      });
      await tx.handle.create({ data: { handle: input.slug, organizationId: o.id } });
      await setOrganizationTags(o.id, input.tags, tx);
      return o;
    });
    await audit({ actorId: actor.id, action: "org.created", entityType: "Organization", entityId: org.id });
    return org;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError(undefined, { slug: "That name is already taken" });
    throw e;
  }
}

export async function updateOrganization(actor: Actor, organizationId: string, input: z.infer<typeof organizationSchema>) {
  await assertOrgPermission(actor, organizationId, "edit");
  const current = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { slug: true, logoKey: true, coverKey: true } });
  if (input.slug !== current.slug.toLowerCase()) {
    await assertOrgPermission(actor, organizationId, "owner");
    await assertHandleAvailable(input.slug, "slug", db, { organizationId });
  }
  await assertOwnedMedia(actor, [input.logoKey, input.coverKey].filter((k) => k && k !== current.logoKey && k !== current.coverKey));
  try {
    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          slug: input.slug,
          name: input.name,
          type: input.type,
          tagline: input.tagline ?? null,
          description: input.description ?? null,
          industry: input.industry ?? null,
          website: input.website ?? null,
          location: input.location ?? null,
          size: input.size ?? null,
          logoKey: input.logoKey ?? null,
          coverKey: input.coverKey ?? null,
        },
      });
      if (input.slug !== current.slug.toLowerCase()) {
        await tx.handle.deleteMany({ where: { organizationId } });
        await tx.handle.create({ data: { handle: input.slug, organizationId } });
      }
      await setOrganizationTags(organizationId, input.tags, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError(undefined, { slug: "That name is already taken" });
    throw e;
  }
  await audit({ actorId: actor.id, action: "org.updated", entityType: "Organization", entityId: organizationId });
}

export async function getOrganizationPage(viewer: Viewer | null, slug: string) {
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          role: true, title: true,
          user: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, headline: true, avatarKey: true, avatarArt: true } } } },
        },
      },
    },
  });
  if (!org || org.status === "REMOVED") return null;
  const viewerRole = await getOrgRole(viewer?.id, org.id);
  if (org.status === "ARCHIVED" && !viewerRole && !isStaff(viewer)) return null;

  const [projects, opportunities, followers, followStatus, partners] = await Promise.all([
    db.project.findMany({
      where: { organizationId: org.id, status: "ACTIVE", ...(viewerRole ? {} : { visibility: "PUBLIC" }) },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, name: true, summary: true, logoKey: true, stage: true, category: true, visibility: true },
    }),
    db.opportunity.findMany({
      where: {
        status: "OPEN",
        OR: [{ organizationId: org.id }, { project: { organizationId: org.id, status: "ACTIVE", visibility: "PUBLIC" } }],
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: opportunityCardSelect,
    }),
    followerCount({ organizationId: org.id }),
    getFollowStatus(viewer?.id, { organizationId: org.id }),
    partnershipsFor({ organizationId: org.id }, "ACTIVE"),
  ]);

  return {
    org: { ...org, members: org.members.filter((m) => m.user.status === "ACTIVE") },
    viewerRole,
    projects,
    opportunities,
    followers,
    followStatus,
    partners,
  };
}


export async function listMyOrganizations(actor: Actor) {
  return db.organizationMember.findMany({
    where: { userId: actor.id, organization: { status: { not: "REMOVED" } } },
    orderBy: { createdAt: "asc" },
    select: { role: true, organization: { select: { id: true, slug: true, name: true, logoKey: true, type: true, status: true, tagline: true } } },
  });
}

export async function getOrganizationForManage(actor: Actor, slug: string) {
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      tags: { select: { tag: { select: { name: true } } } },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { role: true, title: true, createdAt: true, user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } } },
      },
      invitations: {
        where: { status: "PENDING" },
        select: { id: true, role: true, createdAt: true, invitee: { select: { username: true, profile: { select: { displayName: true } } } } },
      },
    },
  });
  if (!org || org.status === "REMOVED") throw new NotFoundError("Organization not found.");
  const role = await assertOrgPermission(actor, org.id, "edit").catch(() => {
    throw new NotFoundError("Organization not found.");
  });
  return { org, role: role! };
}

export async function updateOrgMemberRole(actor: Actor, organizationId: string, userId: string, role: MemberRole) {
  const actorRole = await assertOrgPermission(actor, organizationId, "manageMembers");
  const target = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!target) throw new NotFoundError("Member not found.");
  if (userId === actor.id) throw new ValidationError("You can't change your own role.");
  if (role === "OWNER") throw new ValidationError("Use ownership transfer to make someone the owner.");
  if (!canManageMember(actorRole!, target.role, role)) throw new ForbiddenError();
  await db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId } }, data: { role } });
  await audit({ actorId: actor.id, action: "org.member.role_changed", entityType: "Organization", entityId: organizationId, metadata: { userId, from: target.role, to: role } });
}

export async function removeOrgMember(actor: Actor, organizationId: string, userId: string) {
  const target = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!target) throw new NotFoundError("Member not found.");
  if (userId === actor.id) {
    if (target.role === "OWNER") throw new ValidationError("Transfer ownership before leaving the organization.");
  } else {
    const actorRole = await assertOrgPermission(actor, organizationId, "manageMembers");
    if (!canManageMember(actorRole!, target.role)) throw new ForbiddenError();
  }
  await db.organizationMember.delete({ where: { organizationId_userId: { organizationId, userId } } });
  await audit({ actorId: actor.id, action: userId === actor.id ? "org.member.left" : "org.member.removed", entityType: "Organization", entityId: organizationId, metadata: { userId } });
}

export async function transferOrgOwnership(actor: Actor, organizationId: string, newOwnerId: string) {
  await assertOrgPermission(actor, organizationId, "owner");
  const target = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: newOwnerId } } });
  if (!target || newOwnerId === actor.id) throw new ValidationError("Choose another member of the organization.");
  await db.$transaction([
    db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: newOwnerId } }, data: { role: "OWNER" } }),
    db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: actor.id } }, data: { role: "ADMIN" } }),
  ]);
  await audit({ actorId: actor.id, action: "org.ownership_transferred", entityType: "Organization", entityId: organizationId, metadata: { to: newOwnerId } });
}

export async function setOrganizationArchived(actor: Actor, organizationId: string, archived: boolean) {
  await assertOrgPermission(actor, organizationId, "owner");
  await db.organization.update({ where: { id: organizationId }, data: { status: archived ? "ARCHIVED" : "ACTIVE" } });
  if (archived) {
    await db.opportunity.updateMany({ where: { organizationId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
  }
  await audit({ actorId: actor.id, action: archived ? "org.archived" : "org.restored", entityType: "Organization", entityId: organizationId });
}
