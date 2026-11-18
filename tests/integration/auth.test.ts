import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  authenticate,
  changePassword,
  changeEmail,
  createSession,
  deactivateAccount,
  deleteAccount,
  requestPasswordReset,
  resetPassword,
  signup,
  verifyEmail,
  viewerFromSessionToken,
} from "@/server/auth/service";
import { getPublicProfile } from "@/server/profiles";
import { createUser, resetDb } from "../helpers";

function tokenFrom(text: string) {
  const m = text.match(/token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("no token in email");
  return decodeURIComponent(m[1]);
}

describe("authentication", () => {
  beforeEach(resetDb);

  it("signs up with a profile, a handle and a verification email", async () => {
    const u = await signup({ displayName: "Ana Silva", username: "ana", email: "Ana@Example.test", password: "correct horse battery" });
    const profile = await db.profile.findUnique({ where: { userId: u.id } });
    expect(profile?.displayName).toBe("Ana Silva");
    expect(await db.handle.findUnique({ where: { handle: "ana" } })).toMatchObject({ userId: u.id });
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    const mail = await db.emailOutbox.findFirst({ where: { to: "ana@example.test", kind: "verify-email" } });
    expect(mail).not.toBeNull();

    const userId = await verifyEmail(tokenFrom(mail!.text));
    expect(userId).toBe(u.id);
    expect((await db.user.findUnique({ where: { id: u.id } }))?.emailVerifiedAt).not.toBeNull();
    // Tokens are single-use.
    await expect(verifyEmail(tokenFrom(mail!.text))).rejects.toThrow(/invalid or has expired/);
  });

  it("generates a unique username from the name when none is chosen", async () => {
    const a = await signup({ displayName: "Ana Silva", email: "ana1@example.test", password: "correct horse battery" });
    const b = await signup({ displayName: "Ana Silva", email: "ana2@example.test", password: "correct horse battery" });
    const c = await signup({ displayName: "李明", email: "li@example.test", password: "correct horse battery" });
    expect(a.username).toBe("ana-silva");
    expect(b.username).toMatch(/^ana-silva-\d{4}$/);
    expect(c.username).toMatch(/^member-\d{4}$/);
    for (const u of [a, b, c]) expect(await db.handle.findUnique({ where: { handle: u.username } })).toMatchObject({ userId: u.id });
    // The username never leaks the email address.
    expect(c.username).not.toContain("li");
  });

  it("rejects duplicate emails (case-insensitive) and taken handles", async () => {
    await signup({ displayName: "Ana", username: "ana", email: "ana@example.test", password: "correct horse battery" });
    await expect(signup({ displayName: "Ana 2", username: "ana2", email: "ANA@example.test", password: "correct horse battery" })).rejects.toMatchObject({ fieldErrors: { email: expect.any(String) } });
    await expect(signup({ displayName: "Ana 3", username: "ana", email: "ana3@example.test", password: "correct horse battery" })).rejects.toMatchObject({ fieldErrors: { username: expect.any(String) } });
  });

  it("logs in, resolves sessions and rejects wrong passwords", async () => {
    const u = await createUser({ username: "bob" });
    await expect(authenticate(u.email, "wrong password!!", { ip: "1.1.1.1" })).rejects.toThrow(/Incorrect/);
    await expect(authenticate("nobody@example.test", "whatever123", { ip: "1.1.1.1" })).rejects.toThrow(/Incorrect/);
    const user = await authenticate(u.email, "correct horse battery", { ip: "1.1.1.1" });
    const { token } = await createSession(user.id);
    const viewer = await viewerFromSessionToken(token);
    expect(viewer).toMatchObject({ id: u.id, username: "bob", emailVerified: true });
    expect(viewer).not.toHaveProperty("passwordHash");
    expect(await viewerFromSessionToken("forged-token")).toBeNull();
  });

  it("rate-limits repeated failed logins", async () => {
    const u = await createUser();
    for (let i = 0; i < 10; i++) await authenticate(u.email, "nope-nope-nope", { ip: "9.9.9.9" }).catch(() => undefined);
    await expect(authenticate(u.email, "correct horse battery", { ip: "9.9.9.9" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("resets the password through an emailed token and revokes sessions", async () => {
    const u = await createUser();
    const { token: session } = await createSession(u.id);
    await requestPasswordReset(u.email, { ip: "2.2.2.2" });
    await requestPasswordReset("unknown@example.test", { ip: "2.2.2.2" }); // silent
    const mail = await db.emailOutbox.findFirst({ where: { to: u.email, kind: "password-reset" } });
    await resetPassword(tokenFrom(mail!.text), "a brand new password");
    expect(await viewerFromSessionToken(session)).toBeNull();
    await expect(authenticate(u.email, "a brand new password", { ip: "2.2.2.3" })).resolves.toBeTruthy();
  });

  it("changes password only with the current one and signs out other sessions", async () => {
    const u = await createUser();
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    await expect(changePassword(u, "wrong", "another good password", a.token)).rejects.toMatchObject({ fieldErrors: { currentPassword: expect.any(String) } });
    await changePassword(u, "correct horse battery", "another good password", a.token);
    expect(await viewerFromSessionToken(a.token)).not.toBeNull();
    expect(await viewerFromSessionToken(b.token)).toBeNull();
  });

  it("deactivates (hidden, reactivated on login) and suspends accounts", async () => {
    const u = await createUser({ username: "carla" });
    await deactivateAccount(u, "correct horse battery");
    expect(await getPublicProfile(null, "carla")).toBeNull();
    await authenticate(u.email, "correct horse battery", { ip: "3.3.3.3" });
    expect((await db.user.findUnique({ where: { id: u.id } }))?.status).toBe("ACTIVE");
    await db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    await expect(authenticate(u.email, "correct horse battery", { ip: "3.3.3.4" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("erases personal data on account deletion", async () => {
    const u = await createUser({ username: "dora" });
    await db.post.create({ data: { authorId: u.id, body: "hello" } });
    await deleteAccount(u, "correct horse battery");
    const row = await db.user.findUnique({ where: { id: u.id }, include: { profile: true } });
    expect(row?.status).toBe("DELETED");
    expect(row?.email).not.toContain("dora");
    expect(row?.passwordHash).toBeNull();
    expect(row?.profile).toBeNull();
    expect(await db.post.count({ where: { authorId: u.id } })).toBe(0);
    expect(await db.handle.findUnique({ where: { handle: "dora" } })).toBeNull();
  });
});

describe("data portability", () => {
  beforeEach(resetDb);
  it("exports the user's data without secrets", async () => {
    const { exportAccountData } = await import("@/server/auth/service");
    const u = await createUser({ username: "exporter" });
    await db.post.create({ data: { authorId: u.id, body: "my post" } });
    const data = await exportAccountData(u);
    expect(data.user.username).toBe("exporter");
    expect(data.user.posts).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("scrypt$");
    expect(JSON.stringify(data)).not.toContain("tokenHash");
  });
});


describe("security regressions: recovery credentials", () => {
  beforeEach(resetDb);
  it("allows only one concurrent use of a password-reset token", async () => {
    const u = await createUser();
    await requestPasswordReset(u.email);
    const mail = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "password-reset" } });
    const results = await Promise.allSettled([
      resetPassword(tokenFrom(mail.text), "replacement password one"),
      resetPassword(tokenFrom(mail.text), "replacement password two"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("allows only one concurrent use of an email-verification token", async () => {
    const u = await createUser({ verified: false });
    const mail = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "verify-email" } });
    const results = await Promise.allSettled([verifyEmail(tokenFrom(mail.text)), verifyEmail(tokenFrom(mail.text))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("invalidates old-address reset and verification links when email changes", async () => {
    const u = await createUser({ verified: false });
    await requestPasswordReset(u.email);
    const reset = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "password-reset" } });
    const verify = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "verify-email" } });
    await changeEmail(u, "new-address@example.test", "correct horse battery");
    await expect(resetPassword(tokenFrom(reset.text), "replacement password")).rejects.toThrow(/invalid/);
    await expect(verifyEmail(tokenFrom(verify.text))).rejects.toThrow(/invalid/);
    const fresh = await db.emailOutbox.findFirstOrThrow({ where: { to: "new-address@example.test", kind: "verify-email" } });
    await expect(verifyEmail(tokenFrom(fresh.text))).resolves.toBe(u.id);
  });
  it("invalidates pending reset links after an authenticated password change", async () => {
    const u = await createUser();
    await requestPasswordReset(u.email);
    const mail = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "password-reset" } });
    await changePassword(u, "correct horse battery", "replacement password", null);
    await expect(resetPassword(tokenFrom(mail.text), "attacker password")).rejects.toThrow(/invalid/);
  });
  it("rejects reset links issued before suspension", async () => {
    const u = await createUser();
    await requestPasswordReset(u.email);
    const mail = await db.emailOutbox.findFirstOrThrow({ where: { to: u.email, kind: "password-reset" } });
    await db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    await expect(resetPassword(tokenFrom(mail.text), "replacement password")).rejects.toThrow(/invalid/);
  });
});
