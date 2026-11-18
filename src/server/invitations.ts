import "server-only";
import type { MemberRole } from "@/generated/prisma/enums";
import { db } from "./db";
import { audit } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { assertOrgPermission, assertProjectPermission, hasRank, isBlockedEitherWay } from "./authz";
import { notify } from "./notifications";
import { rateLimit } from "./security/rate-limit";
import type { Actor } from "./auth/types";

type InviteInput = { username: string; role: MemberRole; title?: string; message?: string };

async function findInvitee(actor: Actor, username: string) {
  const user = await db.user.findUnique({ where: { username }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new ValidationError(undefined, { username: "No active member with that username" });
  if (user.id === actor.id) throw new ValidationError(undefined, { username: "You're already on the team" });
  if (await isBlockedEitherWay(actor.id, user.id)) throw new ValidationError(undefined, { username: "No active member with that username" });
  return user;
}

function assertGrantable(actorRole: MemberRole, role: MemberRole) {
  if (role === "OWNER") throw new ValidationError(undefined, { role: "Invite as admin, editor or member" });
  if (actorRole !== "OWNER" && hasRank(role, actorRole)) throw new ForbiddenError("You can only invite people with a role below yours.");
}

export async function inviteToProject(actor: Actor, projectId: string, input: InviteInput) {
  const actorRole = await assertProjectPermission(actor, projectId, "manageMembers");
  assertGrantable(actorRole!, input.role);
  await rateLimit("invitation", actor.id);
  const invitee = await findInvitee(actor, input.username);
  const existing = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: invitee.id } } });
  if (existing) throw new ValidationError(undefined, { username: "Already a member of this project" });
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
  try {
    const inv = await db.invitation.create({
      data: { type: "PROJECT_MEMBER", projectId, inviteeId: invitee.id, inviterId: actor.id, role: input.role, title: input.title ?? null, message: input.message ?? null },
    });
    await notify({ userId: invitee.id, type: "INVITATION", actorId: actor.id, href: "/network/invitations", text: `You've been invited to join ${project.name}.` });
    await audit({ actorId: actor.id, action: "project.member.invited", entityType: "Project", entityId: projectId, metadata: { inviteeId: invitee.id, role: input.role } });
    return inv;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("This person already has a pending invitation.");
    throw e;
  }
}

export async function inviteToOrganization(actor: Actor, organizationId: string, input: InviteInput) {
  const actorRole = await assertOrgPermission(actor, organizationId, "manageMembers");
  assertGrantable(actorRole!, input.role);
  await rateLimit("invitation", actor.id);
  const invitee = await findInvitee(actor, input.username);
  const existing = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: invitee.id } } });
  if (existing) throw new ValidationError(undefined, { username: "Already a member of this organization" });
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
  try {
    const inv = await db.invitation.create({
      data: { type: "ORG_MEMBER", organizationId, inviteeId: invitee.id, inviterId: actor.id, role: input.role, title: input.title ?? null, message: input.message ?? null },
    });
    await notify({ userId: invitee.id, type: "INVITATION", actorId: actor.id, href: "/network/invitations", text: `You've been invited to join ${org.name}.` });
    await audit({ actorId: actor.id, action: "org.member.invited", entityType: "Organization", entityId: organizationId, metadata: { inviteeId: invitee.id, role: input.role } });
    return inv;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("This person already has a pending invitation.");
    throw e;
  }
}

export async function respondToInvitation(actor: Actor, invitationId: string, accept: boolean) {
  const inv = await db.invitation.findUnique({
    where: { id: invitationId },
    include: { project: { select: { name: true, slug: true, status: true } }, organization: { select: { name: true, slug: true, status: true } } },
  });
  if (!inv || inv.inviteeId !== actor.id || inv.status !== "PENDING") throw new NotFoundError("This invitation is no longer available.");
  const entityActive = inv.project ? inv.project.status === "ACTIVE" : inv.organization?.status === "ACTIVE";
  if (accept && !entityActive) throw new NotFoundError("This team is no longer active.");

  await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: inv.id }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
    if (!accept) return;
    if (inv.projectId) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: inv.projectId, userId: actor.id } },
        create: { projectId: inv.projectId, userId: actor.id, role: inv.role, title: inv.title },
        update: {},
      });
    } else if (inv.organizationId) {
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: inv.organizationId, userId: actor.id } },
        create: { organizationId: inv.organizationId, userId: actor.id, role: inv.role, title: inv.title },
        update: {},
      });
    }
    if (inv.inviterId) {
      const me = await tx.profile.findUnique({ where: { userId: actor.id }, select: { displayName: true } });
      const name = inv.project?.name ?? inv.organization?.name ?? "the team";
      const href = inv.project ? `/p/${inv.project.slug}` : `/o/${inv.organization!.slug}`;
      await notify({ userId: inv.inviterId, type: "INVITATION_ACCEPTED", actorId: actor.id, href, text: `${me?.displayName ?? "Someone"} joined ${name}.` }, tx);
    }
  });
  await audit({ actorId: actor.id, action: accept ? "invitation.accepted" : "invitation.declined", entityType: "Invitation", entityId: inv.id });
  return inv;
}

export async function cancelInvitation(actor: Actor, invitationId: string) {
  const inv = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!inv || inv.status !== "PENDING") throw new NotFoundError("This invitation is no longer pending.");
  if (inv.projectId) await assertProjectPermission(actor, inv.projectId, "manageMembers");
  else if (inv.organizationId) await assertOrgPermission(actor, inv.organizationId, "manageMembers");
  await db.invitation.update({ where: { id: inv.id }, data: { status: "CANCELED", respondedAt: new Date() } });
}

export async function listMyInvitations(actor: Actor) {
  return db.invitation.findMany({
    where: { inviteeId: actor.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, role: true, title: true, message: true, createdAt: true,
      project: { select: { slug: true, name: true, summary: true, logoKey: true, status: true } },
      organization: { select: { slug: true, name: true, tagline: true, logoKey: true, status: true } },
      inviter: { select: { username: true, profile: { select: { displayName: true } } } },
    },
  });
}
