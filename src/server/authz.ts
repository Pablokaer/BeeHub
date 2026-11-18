import "server-only";
import type { MemberRole } from "@/generated/prisma/enums";
import { db, type Tx } from "./db";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isStaff, type Actor } from "./auth/types";

/**
 * Centralized authorization. Every service mutation goes through these checks, so
 * permissions are enforced on the server regardless of what the UI shows.
 */

const RANK: Record<MemberRole, number> = { MEMBER: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 };

export type ProjectPermission =
  | "view"
  | "edit" // details, tags, gallery
  | "publish" // posts as the project, opportunities, applications review
  | "manageMembers" // invite/remove/change roles (below own rank)
  | "managePartnerships"
  | "owner"; // delete, transfer ownership

export type OrgPermission = "view" | "edit" | "publish" | "manageMembers" | "managePartnerships" | "owner";

const PROJECT_MIN: Record<ProjectPermission, MemberRole> = {
  view: "MEMBER",
  edit: "EDITOR",
  publish: "EDITOR",
  manageMembers: "ADMIN",
  managePartnerships: "ADMIN",
  owner: "OWNER",
};
const ORG_MIN: Record<OrgPermission, MemberRole> = PROJECT_MIN;

export function hasRank(role: MemberRole | null | undefined, min: MemberRole) {
  return !!role && RANK[role] >= RANK[min];
}

export function maxRole(a: MemberRole | null, b: MemberRole | null): MemberRole | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

export async function getOrgRole(userId: string | null | undefined, organizationId: string, tx: Tx = db): Promise<MemberRole | null> {
  if (!userId) return null;
  const m = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { role: true } });
  return m?.role ?? null;
}

/** Effective project role: direct membership, or delegated from the owning organization (capped at ADMIN). */
export async function getProjectRole(userId: string | null | undefined, projectId: string, tx: Tx = db): Promise<MemberRole | null> {
  if (!userId) return null;
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      organizationId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!project) return null;
  const direct = project.members[0]?.role ?? null;
  let delegated: MemberRole | null = null;
  if (project.organizationId) {
    const orgRole = await getOrgRole(userId, project.organizationId, tx);
    if (orgRole === "OWNER" || orgRole === "ADMIN") delegated = "ADMIN";
    else if (orgRole === "EDITOR") delegated = "EDITOR";
  }
  return maxRole(direct, delegated);
}

export async function assertProjectPermission(actor: Actor, projectId: string, perm: ProjectPermission, tx: Tx = db) {
  const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, status: true, visibility: true } });
  if (!project || project.status === "REMOVED") throw new NotFoundError("Project not found.");
  const role = await getProjectRole(actor.id, projectId, tx);
  if (perm === "view") {
    if (project.visibility === "PUBLIC" || role || isStaff(actor)) return role;
    throw new NotFoundError("Project not found.");
  }
  if (!hasRank(role, PROJECT_MIN[perm])) {
    if (!role && project.visibility === "PRIVATE") throw new NotFoundError("Project not found.");
    throw new ForbiddenError();
  }
  return role!;
}

export async function assertOrgPermission(actor: Actor, organizationId: string, perm: OrgPermission, tx: Tx = db) {
  const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, status: true } });
  if (!org || org.status === "REMOVED") throw new NotFoundError("Organization not found.");
  const role = await getOrgRole(actor.id, organizationId, tx);
  if (perm === "view") return role;
  if (!hasRank(role, ORG_MIN[perm])) throw new ForbiddenError();
  return role!;
}

/** Whether `actor` may change a member with `targetRole` to `newRole`. */
export function canManageMember(actorRole: MemberRole, targetRole: MemberRole, newRole?: MemberRole) {
  if (actorRole === "OWNER") return true;
  if (!hasRank(actorRole, "ADMIN")) return false;
  // Admins manage editors and members, and cannot grant admin/owner.
  if (RANK[targetRole] >= RANK[actorRole]) return false;
  if (newRole && RANK[newRole] >= RANK[actorRole]) return false;
  return true;
}

export type ActingAs =
  | { kind: "user" }
  | { kind: "org"; organizationId: string }
  | { kind: "project"; projectId: string };

/** Parses "user" | "org:<id>" | "project:<id>" and checks the actor may publish as that entity. */
export async function resolveActingAs(actor: Actor, raw: string | undefined, tx: Tx = db): Promise<ActingAs> {
  if (!raw || raw === "user") return { kind: "user" };
  const [kind, id] = raw.split(":");
  if (kind === "org" && id) {
    const org = await tx.organization.findUnique({ where: { id }, select: { status: true } });
    if (!org || org.status !== "ACTIVE") throw new ValidationError("That organization is not available.");
    await assertOrgPermission(actor, id, "publish", tx);
    return { kind: "org", organizationId: id };
  }
  if (kind === "project" && id) {
    const project = await tx.project.findUnique({ where: { id }, select: { status: true } });
    if (!project || project.status !== "ACTIVE") throw new ValidationError("That project is not available.");
    await assertProjectPermission(actor, id, "publish", tx);
    return { kind: "project", projectId: id };
  }
  throw new ValidationError("Invalid identity.");
}

/** Entities (orgs, projects) the actor may publish as — used to build "post as" pickers. */
export async function listPublishIdentities(userId: string) {
  const [orgs, projects] = await Promise.all([
    db.organizationMember.findMany({
      where: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] }, organization: { status: "ACTIVE" } },
      select: { organization: { select: { id: true, name: true, slug: true, logoKey: true } } },
    }),
    db.projectMember.findMany({
      where: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] }, project: { status: "ACTIVE" } },
      select: { project: { select: { id: true, name: true, slug: true, logoKey: true } } },
    }),
  ]);
  return {
    orgs: orgs.map((o) => o.organization),
    projects: projects.map((p) => p.project),
  };
}

/** True when either user has blocked the other. */
export async function isBlockedEitherWay(a: string, b: string, tx: Tx = db) {
  if (a === b) return false;
  const n = await tx.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return n > 0;
}

export async function blockedUserIds(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
}
