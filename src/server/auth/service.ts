import "server-only";
import type { z } from "zod";
import type { signupSchema } from "@/lib/validation";
import { db, type Tx } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError, isUniqueViolation } from "../errors";
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from "../security/crypto";
import { rateLimit, resetRateLimit } from "../security/rate-limit";
import { sendEmail } from "../mail/mailer";
import { passwordChangedTemplate, resetPasswordTemplate, verifyEmailTemplate } from "../mail/templates";
import { assertHandleAvailable } from "../handles";
import { USERNAME_FALLBACK, usernameBase } from "@/lib/slug";
import { randomInt } from "node:crypto";
import type { Actor, RequestContext, Viewer } from "./types";

const VERIFY_TTL_MS = 48 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;

// Serialize credential transitions and token issuance for the same account.
async function lockCredentials(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}


// ───────────── Sign up ─────────────

type SignupInput = z.infer<typeof signupSchema> & {
  /** Explicit username (seed data, tests). Public sign-up leaves it out and one is generated. */
  username?: string;
};

const USERNAME_ATTEMPTS = 8;

/** Candidate usernames: the name itself first, then the name with a random 4-digit suffix. */
function usernameCandidate(base: string, attempt: number) {
  const bare = attempt === 0 && base !== USERNAME_FALLBACK; // a bare "member" handle would be meaningless
  return bare ? base : `${base}-${randomInt(1000, 10000)}`;
}

export async function signup(raw: SignupInput, ctx: RequestContext = {}) {
  await rateLimit("signup", ctx.ip ?? "unknown");
  const email = raw.email.trim().toLowerCase();
  const chosen = raw.username?.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ValidationError("Please check the highlighted fields.", { email: "An account with this email already exists" });
  if (chosen) await assertHandleAvailable(chosen, "username");

  const passwordHash = await hashPassword(raw.password);
  const base = usernameBase(raw.displayName);
  for (let attempt = 0; attempt < (chosen ? 1 : USERNAME_ATTEMPTS); attempt++) {
    const username = chosen ?? usernameCandidate(base, attempt);
    if (!chosen && (await db.handle.findUnique({ where: { handle: username }, select: { handle: true } }))) continue;
    try {
      const user = await db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email, username, passwordHash, profile: { create: { displayName: raw.displayName, links: raw.links ?? [] } } },
        });
        await tx.handle.create({ data: { handle: username, userId: u.id } });
        return u;
      });
      await audit({ actorId: user.id, action: "auth.signup", entityType: "User", entityId: user.id, ip: ctx.ip });
      await issueEmailVerification(user.id);
      return user;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Lost a race: on the email, report it; on the handle, try the next candidate.
      if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
        throw new ValidationError("Please check the highlighted fields.", { email: "An account with this email already exists" });
      }
      if (chosen) throw new ValidationError("Please check the highlighted fields.", { username: "That username is taken" });
    }
  }
  throw new ConflictError("We couldn't create your account right now. Please try again.");
}

// ───────────── Login / sessions ─────────────

export async function authenticate(email: string, password: string, ctx: RequestContext = {}) {
  const subject = `${email.toLowerCase()}|${ctx.ip ?? "unknown"}`;
  await rateLimit("login", subject);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.status === "DELETED") {
    await verifyPassword(password, await getDummyHash());
    throw new ValidationError("Incorrect email or password.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await audit({ actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, ip: ctx.ip });
    throw new ValidationError("Incorrect email or password.");
  }
  if (user.status === "SUSPENDED") throw new ForbiddenError("This account has been suspended. Contact support if you think this is a mistake.");
  if (user.status === "DEACTIVATED") {
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    await audit({ actorId: user.id, action: "auth.reactivated", entityType: "User", entityId: user.id, ip: ctx.ip });
  }
  await resetRateLimit("login", subject);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip: ctx.ip });
  return user;
}

export async function createSession(userId: string, ctx: RequestContext = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86400 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ip: ctx.ip?.slice(0, 64) ?? null,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
    },
  });
  return { token, expiresAt };
}

/** Resolves a raw session token to the viewer, or null if invalid/expired/inactive. */
export async function viewerFromSessionToken(token: string): Promise<Viewer | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true, email: true, username: true, role: true, status: true, emailVerifiedAt: true,
          profile: { select: { displayName: true, avatarKey: true, avatarArt: true, headline: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "ACTIVE") return null;
  // Touch lastSeenAt at most every 10 minutes.
  if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    displayName: u.profile?.displayName ?? u.username,
    avatarKey: u.profile?.avatarKey ?? null,
    avatarArt: u.profile?.avatarArt ?? null,
    headline: u.profile?.headline ?? null,
  };
}

export async function deleteSessionByToken(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function listSessions(actor: Actor) {
  return db.session.findMany({
    where: { userId: actor.id, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true, tokenHash: true },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function revokeSession(actor: Actor, sessionId: string) {
  await db.session.deleteMany({ where: { id: sessionId, userId: actor.id } });
  await audit({ actorId: actor.id, action: "auth.session_revoked", entityType: "Session", entityId: sessionId });
}

export async function revokeOtherSessions(actor: Actor, currentToken: string | null) {
  await db.session.deleteMany({
    where: { userId: actor.id, ...(currentToken ? { tokenHash: { not: sha256(currentToken) } } : {}) },
  });
}

// ───────────── Email verification ─────────────

export async function issueEmailVerification(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user || user.emailVerifiedAt) return;
  const token = randomToken(32);
  const issued = await db.$transaction(async (tx) => {
    await lockCredentials(tx, userId);
    const current = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    if (!current || current.email !== user.email || current.emailVerifiedAt) return false;
    await tx.authToken.deleteMany({ where: { userId, type: "EMAIL_VERIFY", usedAt: null } });
    await tx.authToken.create({ data: { userId, type: "EMAIL_VERIFY", tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) } });
    return true;
  });
  if (!issued) return;
  const tpl = verifyEmailTemplate(user.profile?.displayName ?? user.username, token);
  await sendEmail({ to: user.email, subject: tpl.subject, text: tpl.text, kind: "verify-email" });
}

export async function resendVerification(actor: Actor) {
  await rateLimit("verifyEmail", actor.id);
  await issueEmailVerification(actor.id);
}

export async function verifyEmail(token: string) {
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) {
    throw new NotFoundError("This verification link is invalid or has expired.");
  }
  await db.$transaction(async (tx) => {
    await lockCredentials(tx, record.userId);
    const consumed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new NotFoundError("This verification link is invalid or has expired.");
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  });
  await audit({ actorId: record.userId, action: "auth.email_verified", entityType: "User", entityId: record.userId });
  return record.userId;
}

// ───────────── Password reset / change ─────────────

/** Always resolves without revealing whether the email exists. */
export async function requestPasswordReset(email: string, ctx: RequestContext = {}) {
  await rateLimit("passwordReset", `${email}|${ctx.ip ?? "unknown"}`);
  const user = await db.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user || user.status === "DELETED" || user.status === "SUSPENDED") return;
  const token = randomToken(32);
  const issued = await db.$transaction(async (tx) => {
    await lockCredentials(tx, user.id);
    const current = await tx.user.findUnique({ where: { id: user.id }, select: { email: true, status: true } });
    if (!current || current.email !== email || current.status === "DELETED" || current.status === "SUSPENDED") return false;
    await tx.authToken.deleteMany({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null } });
    await tx.authToken.create({ data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
    return true;
  });
  if (!issued) return;
  const tpl = resetPasswordTemplate(user.profile?.displayName ?? user.username, token);
  await sendEmail({ to: user.email, subject: tpl.subject, text: tpl.text, kind: "password-reset" });
  await audit({ actorId: user.id, action: "auth.password_reset_requested", entityType: "User", entityId: user.id, ip: ctx.ip });
}

export async function resetPassword(token: string, password: string, ctx: RequestContext = {}) {
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    throw new ValidationError("This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(password);
  // Resetting via an emailed link also proves ownership of the address.
  const user = await db.$transaction(async (tx) => {
    await lockCredentials(tx, record.userId);
    const consumed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() }, user: { status: { in: ["ACTIVE", "DEACTIVATED"] } } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ValidationError("This reset link is invalid or has expired. Request a new one.");
    await tx.session.deleteMany({ where: { userId: record.userId } });
    return tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, emailVerifiedAt: new Date() },
      include: { profile: true },
    });
  });
  await audit({ actorId: user.id, action: "auth.password_reset", entityType: "User", entityId: user.id, ip: ctx.ip });
  const tpl = passwordChangedTemplate(user.profile?.displayName ?? user.username);
  await sendEmail({ to: user.email, subject: tpl.subject, text: tpl.text, kind: "password-changed" });
  return user;
}

async function requirePassword(actor: Actor, password: string) {
  await rateLimit("login", `sensitive-account|${actor.id}`);
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user) throw new UnauthenticatedError();
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new ValidationError("Please check the highlighted fields.", { currentPassword: "Incorrect password" });
  }
}

export async function changePassword(actor: Actor, currentPassword: string, password: string, currentToken: string | null) {
  await rateLimit("login", `change-password|${actor.id}`);
  await requirePassword(actor, currentPassword);
  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    await lockCredentials(tx, actor.id);
    await tx.authToken.deleteMany({ where: { userId: actor.id, type: "PASSWORD_RESET" } });
    return tx.user.update({ where: { id: actor.id }, data: { passwordHash }, include: { profile: true } });
  });
  await revokeOtherSessions(actor, currentToken);
  await audit({ actorId: actor.id, action: "auth.password_changed", entityType: "User", entityId: actor.id });
  const tpl = passwordChangedTemplate(user.profile?.displayName ?? user.username);
  await sendEmail({ to: user.email, subject: tpl.subject, text: tpl.text, kind: "password-changed" });
}

export async function changeEmail(actor: Actor, email: string, currentPassword: string) {
  await requirePassword(actor, currentPassword);
  const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== actor.id) throw new ValidationError("Please check the highlighted fields.", { email: "This email is already in use" });
  try {
    await db.$transaction(async (tx) => {
      await lockCredentials(tx, actor.id);
      // Tokens delivered to the previous address must no longer authorize this account.
      await tx.authToken.deleteMany({ where: { userId: actor.id } });
      await tx.user.update({ where: { id: actor.id }, data: { email, emailVerifiedAt: null } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("This email is already in use");
    throw e;
  }
  await audit({ actorId: actor.id, action: "auth.email_changed", entityType: "User", entityId: actor.id });
  await issueEmailVerification(actor.id);
}

// ───────────── Deactivation & deletion (GDPR) ─────────────

export async function deactivateAccount(actor: Actor, currentPassword: string) {
  await requirePassword(actor, currentPassword);
  await db.$transaction([
    db.user.update({ where: { id: actor.id }, data: { status: "DEACTIVATED" } }),
    db.session.deleteMany({ where: { userId: actor.id } }),
  ]);
  await audit({ actorId: actor.id, action: "auth.deactivated", entityType: "User", entityId: actor.id });
}

/**
 * Right to erasure: removes personal data and authored content, releases handle and
 * email, and hands over (or archives) entities the user solely owned. The user row is
 * kept as an anonymous tombstone so foreign keys in other people's history stay valid.
 */
export async function deleteAccount(actor: Actor, currentPassword: string) {
  await requirePassword(actor, currentPassword);
  const userId = actor.id;
  await db.$transaction(async (tx) => {
    // Projects/orgs: transfer ownership to another admin when possible, otherwise archive privately.
    const ownedProjects = await tx.projectMember.findMany({ where: { userId, role: "OWNER" }, select: { projectId: true } });
    for (const { projectId } of ownedProjects) {
      const heir = await tx.projectMember.findFirst({
        where: { projectId, userId: { not: userId }, role: { in: ["OWNER", "ADMIN"] } },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      });
      if (heir) await tx.projectMember.update({ where: { projectId_userId: { projectId, userId: heir.userId } }, data: { role: "OWNER" } });
      else await tx.project.update({ where: { id: projectId }, data: { status: "ARCHIVED", visibility: "PRIVATE" } });
    }
    const ownedOrgs = await tx.organizationMember.findMany({ where: { userId, role: "OWNER" }, select: { organizationId: true } });
    for (const { organizationId } of ownedOrgs) {
      const heir = await tx.organizationMember.findFirst({
        where: { organizationId, userId: { not: userId }, role: { in: ["OWNER", "ADMIN"] } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      });
      if (heir) await tx.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: heir.userId } }, data: { role: "OWNER" } });
      else await tx.organization.update({ where: { id: organizationId }, data: { status: "ARCHIVED" } });
    }
    // Personal content and relationships.
    await tx.post.deleteMany({ where: { authorId: userId } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.conversationParticipant.deleteMany({ where: { userId } });
    await tx.application.deleteMany({ where: { applicantId: userId } });
    await tx.reaction.deleteMany({ where: { userId } });
    await tx.savedPost.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { userId }] } });
    await tx.connection.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
    await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.projectMember.deleteMany({ where: { userId } });
    await tx.organizationMember.deleteMany({ where: { userId } });
    await tx.invitation.deleteMany({ where: { inviteeId: userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.userTag.deleteMany({ where: { userId } });
    await tx.experience.deleteMany({ where: { userId } });
    await tx.education.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.authToken.deleteMany({ where: { userId } });
    await tx.externalAccount.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.profile.deleteMany({ where: { userId } });
    await tx.handle.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        email: `deleted+${userId}@invalid.local`,
        username: `deleted-${userId}`,
        passwordHash: null,
        emailVerifiedAt: null,
      },
    });
  });
  await audit({ actorId: null, action: "auth.account_deleted", entityType: "User", entityId: userId });
}

/** Data portability: everything we hold about the user, as JSON. */
export async function exportAccountData(actor: Actor) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true, email: true, username: true, createdAt: true, emailVerifiedAt: true,
      profile: true,
      skills: { select: { kind: true, tag: { select: { name: true } } } },
      experiences: true,
      educations: true,
      orgMemberships: { select: { role: true, title: true, organization: { select: { name: true, slug: true } } } },
      projectMemberships: { select: { role: true, title: true, project: { select: { name: true, slug: true } } } },
      posts: { select: { id: true, body: true, type: true, createdAt: true, status: true } },
      comments: { select: { id: true, postId: true, body: true, createdAt: true } },
      applications: { select: { id: true, opportunityId: true, message: true, status: true, createdAt: true } },
      messages: { select: { id: true, conversationId: true, body: true, createdAt: true } },
      following: { select: { userId: true, organizationId: true, projectId: true, createdAt: true } },
      sessions: { select: { createdAt: true, lastSeenAt: true, ip: true, userAgent: true } },
    },
  });
  if (!user) throw new NotFoundError();
  const connections = await db.connection.findMany({
    where: { status: "ACCEPTED", OR: [{ userAId: actor.id }, { userBId: actor.id }] },
    select: { userAId: true, userBId: true, createdAt: true },
  });
  return { exportedAt: new Date().toISOString(), user, connections };
}
