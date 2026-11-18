import "server-only";
import type { z } from "zod";
import type { MemberRole } from "@/generated/prisma/enums";
import type { projectSchema } from "@/lib/validation";
import { db } from "./db";
import { audit } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { assertOrgPermission, assertProjectPermission, canManageMember, getProjectRole } from "./authz";
import { assertHandleAvailable } from "./handles";
import { setProjectTags } from "./tags";
import { assertOwnedMedia } from "./uploads";
import { followerCount, getFollowStatus } from "./social/graph";
import { partnershipsFor } from "./partnerships";
import { opportunityCardSelect, projectCardSelect } from "./selects";
import { isStaff, type Actor, type Viewer } from "./auth/types";

function projectData(input: z.infer<typeof projectSchema>) {
  return {
    slug: input.slug,
    name: input.name,
    summary: input.summary,
    description: input.description ?? null,
    goals: input.goals ?? null,
    needs: input.needs ?? null,
    category: input.category,
    stage: input.stage,
    visibility: input.visibility,
    websiteUrl: input.websiteUrl ?? null,
    repoUrl: input.repoUrl ?? null,
    isOpenSource: input.isOpenSource,
    acceptsBeginners: input.acceptsBeginners,
    logoKey: input.logoKey ?? null,
    coverKey: input.coverKey ?? null,
  };
}

export async function createProject(actor: Actor, input: z.infer<typeof projectSchema>) {
  if (input.organizationId) await assertOrgPermission(actor, input.organizationId, "publish");
  await assertHandleAvailable(input.slug, "slug");
  await assertOwnedMedia(actor, [input.logoKey, input.coverKey]);
  try {
    const project = await db.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          ...projectData(input),
          organizationId: input.organizationId ?? null,
          createdById: actor.id,
          members: { create: { userId: actor.id, role: "OWNER", title: "Founder" } },
        },
      });
      await tx.handle.create({ data: { handle: input.slug, projectId: p.id } });
      await setProjectTags(p.id, "TECH", input.tech, tx);
      await setProjectTags(p.id, "TOPIC", input.topics, tx);
      return p;
    });
    await audit({ actorId: actor.id, action: "project.created", entityType: "Project", entityId: project.id });
    return project;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError(undefined, { slug: "That name is already taken" });
    throw e;
  }
}

export async function updateProject(actor: Actor, projectId: string, input: z.infer<typeof projectSchema>) {
  await assertProjectPermission(actor, projectId, "edit");
  const current = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { slug: true, logoKey: true, coverKey: true, organizationId: true } });
  const slugChanged = input.slug !== current.slug.toLowerCase();
  if (slugChanged) {
    await assertProjectPermission(actor, projectId, "owner");
    await assertHandleAvailable(input.slug, "slug", db, { projectId });
  }
  if ((input.organizationId ?? null) !== current.organizationId) {
    await assertProjectPermission(actor, projectId, "owner");
    if (input.organizationId) await assertOrgPermission(actor, input.organizationId, "publish");
  }
  await assertOwnedMedia(actor, [input.logoKey, input.coverKey].filter((k) => k && k !== current.logoKey && k !== current.coverKey));
  try {
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: projectId }, data: { ...projectData(input), organizationId: input.organizationId ?? null } });
      if (slugChanged) {
        await tx.handle.deleteMany({ where: { projectId } });
        await tx.handle.create({ data: { handle: input.slug, projectId } });
      }
      await setProjectTags(projectId, "TECH", input.tech, tx);
      await setProjectTags(projectId, "TOPIC", input.topics, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError(undefined, { slug: "That name is already taken" });
    throw e;
  }
  await audit({ actorId: actor.id, action: "project.updated", entityType: "Project", entityId: projectId });
}

/** Public project page data. Private projects are only visible to their team (and staff). */
export async function getProjectPage(viewer: Viewer | null, slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    include: {
      tags: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
      images: { orderBy: { position: "asc" } },
      organization: { select: { id: true, slug: true, name: true, logoKey: true, status: true } },
      createdBy: { select: { username: true, status: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } },
      members: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        select: {
          role: true, title: true, joinedAt: true,
          user: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, headline: true, avatarKey: true, avatarArt: true } } } },
        },
      },
    },
  });
  if (!project || project.status === "REMOVED") return null;
  const viewerRole = await getProjectRole(viewer?.id, project.id);
  const canView = project.visibility === "PUBLIC" || !!viewerRole || isStaff(viewer);
  if (!canView) return null;
  if (project.status === "ARCHIVED" && !viewerRole && !isStaff(viewer)) return null;

  const [opportunities, partners, followers, followStatus] = await Promise.all([
    db.opportunity.findMany({
      where: { projectId: project.id, status: viewerRole ? { in: ["OPEN", "DRAFT", "CLOSED", "FILLED"] } : "OPEN" },
      orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
      select: opportunityCardSelect,
    }),
    partnershipsFor({ projectId: project.id }, "ACTIVE"),
    followerCount({ projectId: project.id }),
    getFollowStatus(viewer?.id, { projectId: project.id }),
  ]);

  return {
    project: { ...project, members: project.members.filter((m) => m.user.status === "ACTIVE") },
    viewerRole,
    opportunities,
    partners,
    followers,
    followStatus,
  };
}

export async function getProjectForManage(actor: Actor, slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    include: {
      tags: { select: { kind: true, tag: { select: { name: true } } } },
      images: { orderBy: { position: "asc" } },
      organization: { select: { id: true, slug: true, name: true } },
      members: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        select: {
          role: true, title: true, joinedAt: true, opportunityId: true,
          opportunity: { select: { id: true, title: true } },
          user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } } } },
        },
      },
      invitations: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, role: true, title: true, createdAt: true, invitee: { select: { username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } } },
      },
    },
  });
  if (!project || project.status === "REMOVED") throw new NotFoundError("Project not found.");
  const role = await getProjectRole(actor.id, project.id);
  if (!role || role === "MEMBER") throw new NotFoundError("Project not found.");
  return { project, role };
}

export async function listMyProjects(actor: Actor) {
  const [memberships, followed] = await Promise.all([
    db.projectMember.findMany({
      where: { userId: actor.id, project: { status: { not: "REMOVED" } } },
      orderBy: { joinedAt: "desc" },
      select: { role: true, title: true, project: { select: { ...projectCardSelect, status: true } } },
    }),
    db.follow.findMany({
      where: { followerId: actor.id, projectId: { not: null }, project: { status: "ACTIVE", visibility: "PUBLIC" } },
      orderBy: { createdAt: "desc" },
      select: { project: { select: projectCardSelect } },
    }),
  ]);
  return { memberships, followed: followed.map((f) => f.project!).filter(Boolean) };
}

// ───────────── Gallery ─────────────

export async function addProjectImage(actor: Actor, projectId: string, key: string, caption?: string) {
  await assertProjectPermission(actor, projectId, "edit");
  await assertOwnedMedia(actor, [key]);
  const count = await db.projectImage.count({ where: { projectId } });
  if (count >= 12) throw new ValidationError("A project gallery can hold up to 12 images.");
  await db.projectImage.create({ data: { projectId, key, caption: caption ?? null, position: count } });
}

export async function removeProjectImage(actor: Actor, projectId: string, imageId: string) {
  await assertProjectPermission(actor, projectId, "edit");
  await db.projectImage.deleteMany({ where: { id: imageId, projectId } });
}

// ───────────── Team ─────────────

export async function updateProjectMember(actor: Actor, projectId: string, userId: string, data: { role?: MemberRole; title?: string | null }) {
  const actorRole = await assertProjectPermission(actor, projectId, "manageMembers");
  const target = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!target) throw new NotFoundError("Member not found.");
  if (data.role && data.role !== target.role) {
    if (userId === actor.id) throw new ValidationError("You can't change your own role.");
    if (data.role === "OWNER") throw new ValidationError("Use ownership transfer to make someone the owner.");
    if (!canManageMember(actorRole!, target.role, data.role)) throw new ForbiddenError();
  } else if (userId !== actor.id && !canManageMember(actorRole!, target.role)) {
    throw new ForbiddenError();
  }
  await db.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { ...(data.role ? { role: data.role } : {}), ...(data.title !== undefined ? { title: data.title } : {}) },
  });
  await audit({ actorId: actor.id, action: "project.member.updated", entityType: "Project", entityId: projectId, metadata: { userId, ...data } });
}

export async function removeProjectMember(actor: Actor, projectId: string, userId: string) {
  const target = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!target) throw new NotFoundError("Member not found.");
  if (userId === actor.id) {
    if (target.role === "OWNER") throw new ValidationError("Transfer ownership before leaving the project.");
  } else {
    const actorRole = await assertProjectPermission(actor, projectId, "manageMembers");
    if (!canManageMember(actorRole!, target.role)) throw new ForbiddenError();
  }
  await db.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  await audit({ actorId: actor.id, action: userId === actor.id ? "project.member.left" : "project.member.removed", entityType: "Project", entityId: projectId, metadata: { userId } });
}

export async function transferProjectOwnership(actor: Actor, projectId: string, newOwnerId: string) {
  await assertProjectPermission(actor, projectId, "owner");
  const target = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: newOwnerId } } });
  if (!target || newOwnerId === actor.id) throw new ValidationError("Choose another member of the team.");
  await db.$transaction([
    db.projectMember.update({ where: { projectId_userId: { projectId, userId: newOwnerId } }, data: { role: "OWNER" } }),
    db.projectMember.update({ where: { projectId_userId: { projectId, userId: actor.id } }, data: { role: "ADMIN" } }),
  ]);
  await audit({ actorId: actor.id, action: "project.ownership_transferred", entityType: "Project", entityId: projectId, metadata: { to: newOwnerId } });
}

export async function setProjectArchived(actor: Actor, projectId: string, archived: boolean) {
  await assertProjectPermission(actor, projectId, "owner");
  await db.project.update({ where: { id: projectId }, data: { status: archived ? "ARCHIVED" : "ACTIVE" } });
  if (archived) await db.opportunity.updateMany({ where: { projectId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
  await audit({ actorId: actor.id, action: archived ? "project.archived" : "project.restored", entityType: "Project", entityId: projectId });
}

/**
 * Complementary projects: public projects whose technologies or team skills cover the
 * skills this project is currently looking for (its open opportunities).
 */
export async function suggestComplementaryProjects(projectId: string, take = 5) {
  const needs = await db.opportunityTag.findMany({
    where: { kind: "SKILL", opportunity: { projectId, status: "OPEN" } },
    select: { tagId: true, tag: { select: { name: true } } },
  });
  const needIds = [...new Set(needs.map((n) => n.tagId))];
  if (needIds.length === 0) return [];
  const existing = await partnershipsFor({ projectId }, ["ACTIVE", "PENDING"]);
  const exclude = new Set([projectId, ...existing.filter((e) => e.other.kind === "project").map((e) => e.other.id)]);
  const candidates = await db.project.findMany({
    where: {
      id: { notIn: [...exclude] },
      status: "ACTIVE",
      visibility: "PUBLIC",
      OR: [
        { tags: { some: { tagId: { in: needIds } } } },
        { members: { some: { user: { status: "ACTIVE", skills: { some: { kind: "SKILL", tagId: { in: needIds } } } } } } },
      ],
    },
    take: 30,
    select: {
      ...projectCardSelect,
      tags: { select: { tagId: true, kind: true, tag: { select: { slug: true, name: true } } } },
      members: { select: { user: { select: { skills: { where: { kind: "SKILL", tagId: { in: needIds } }, select: { tagId: true } } } } } },
    },
  });
  const nameById = new Map(needs.map((n) => [n.tagId, n.tag.name]));
  return candidates
    .map((c) => {
      const covered = new Set<string>();
      for (const t of c.tags) if (needIds.includes(t.tagId)) covered.add(t.tagId);
      for (const m of c.members) for (const s of m.user.skills) covered.add(s.tagId);
      return { project: c, covers: [...covered].map((id) => nameById.get(id)!).filter(Boolean) };
    })
    .sort((a, b) => b.covers.length - a.covers.length)
    .slice(0, take);
}
