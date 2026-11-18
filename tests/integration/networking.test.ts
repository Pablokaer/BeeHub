import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { canMessage, getConversation, listConversations, messagesSince, sendMessage, startConversation, unreadConversationCount } from "@/server/messaging";
import { respondToConnectionRequest, sendConnectionRequest, blockUser } from "@/server/social/graph";
import { listNotifications, markAllNotificationsRead, unreadNotificationCount, updateNotificationPreferences } from "@/server/notifications";
import { deliverQueuedNotificationEmails } from "@/server/notification-email";
import { createOrganization, removeOrgMember, updateOrgMemberRole } from "@/server/organizations";
import { cancelInvitation, inviteToOrganization, respondToInvitation } from "@/server/invitations";
import { createProject, removeProjectMember, transferProjectOwnership } from "@/server/projects";
import { createPost } from "@/server/posts";
import { resolveActingAs } from "@/server/authz";
import { createUser, resetDb } from "../helpers";

describe("messaging", () => {
  beforeEach(resetDb);

  it("delivers messages, tracks unread state and enforces permissions", async () => {
    const a = await createUser({ username: "msg-a" });
    const b = await createUser({ username: "msg-b" });
    const c = await createUser({ username: "msg-c" });
    await db.profile.update({ where: { userId: b.id }, data: { messagePermission: "CONNECTIONS" } });
    expect(await canMessage(a.id, b.id)).toEqual({ allowed: false, reason: expect.stringContaining("connections") });
    await expect(startConversation(a, b.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await sendConnectionRequest(a, b.id);
    await respondToConnectionRequest(b, a.id, true);
    const conv = await startConversation(a, b.id);
    const t0 = new Date(Date.now() - 1000);
    await sendMessage(a, conv, "Hello there");
    await sendMessage(a, conv, "Second message");
    expect(await unreadConversationCount(b.id)).toBe(1);
    // One notification per unread conversation, not per message.
    expect(await db.notification.count({ where: { userId: b.id, type: "NEW_MESSAGE" } })).toBe(1);
    const view = await getConversation(b, conv);
    expect(view.messages.map((m) => m.body)).toEqual(["Hello there", "Second message"]);
    expect(await unreadConversationCount(b.id)).toBe(0);
    expect((await messagesSince(b, conv, t0)).length).toBe(2);

    // Outsiders can't read it.
    await expect(getConversation(c, conv)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Blocking closes the channel in both directions.
    await blockUser(b, a.id);
    await expect(sendMessage(a, conv, "still there?")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getConversation(a, conv)).canSend).toBe(false);
    expect((await listConversations(a))[0].id).toBe(conv);
  });
});

describe("notifications", () => {
  beforeEach(resetDb);

  it("respects preferences and queues email digests", async () => {
    const a = await createUser();
    const b = await createUser();
    await updateNotificationPreferences(b, [
      { type: "CONNECTION_REQUEST", inApp: true, email: true },
      { type: "CONNECTION_ACCEPTED", inApp: false, email: false },
    ]);
    await sendConnectionRequest(a, b.id);
    expect(await unreadNotificationCount(b.id)).toBe(1);
    const { items } = await listNotifications(b);
    expect(items[0]).toMatchObject({ type: "CONNECTION_REQUEST", href: "/network/requests" });
    expect(await db.notification.count({ where: { userId: b.id, emailStatus: "QUEUED" } })).toBe(1);

    const r = await deliverQueuedNotificationEmails();
    expect(r.users).toBe(1);
    expect(await db.emailOutbox.count({ where: { to: b.email, kind: "notification-digest" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: b.id, emailStatus: "QUEUED" } })).toBe(0);

    await markAllNotificationsRead(b);
    expect(await unreadNotificationCount(b.id)).toBe(0);
    // In-app disabled for this type: no row is created.
    await updateNotificationPreferences(a, [{ type: "CONNECTION_ACCEPTED", inApp: false, email: false }]);
    await respondToConnectionRequest(b, a.id, true);
    expect(await db.notification.count({ where: { userId: a.id, type: "CONNECTION_ACCEPTED" } })).toBe(0);
  });
});

describe("organizations, roles and invitations", () => {
  beforeEach(resetDb);

  it("manages roles, publishing as the organization and ownership rules", async () => {
    const owner = await createUser({ username: "org-owner" });
    const ed = await createUser({ username: "org-editor" });
    const mem = await createUser({ username: "org-member" });
    const org = await createOrganization(owner, { name: "Acme", slug: "acme-co", type: "COMPANY", tags: ["Design"] });
    const inv1 = await inviteToOrganization(owner, org.id, { username: "org-editor", role: "EDITOR" });
    const inv2 = await inviteToOrganization(owner, org.id, { username: "org-member", role: "MEMBER" });
    await respondToInvitation(ed, inv1.id, true);
    await respondToInvitation(mem, inv2.id, false);
    await expect(respondToInvitation(mem, inv2.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Editors publish as the org; members/outsiders can't.
    await createPost(ed, { actingAs: `org:${org.id}`, type: "TEXT", body: "Hello from Acme", imageKeys: [] });
    await expect(resolveActingAs(mem, `org:${org.id}`)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Editors can't manage members; owners can't be demoted by others.
    await expect(updateOrgMemberRole(ed, org.id, owner.id, "MEMBER")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeOrgMember(owner, org.id, owner.id)).rejects.toMatchObject({ code: "VALIDATION" });
    const inv3 = await inviteToOrganization(owner, org.id, { username: "org-member", role: "ADMIN" });
    await cancelInvitation(owner, inv3.id);
    expect((await db.invitation.findUnique({ where: { id: inv3.id } }))?.status).toBe("CANCELED");
    await updateOrgMemberRole(owner, org.id, ed.id, "ADMIN");
    expect((await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: org.id, userId: ed.id } } }))?.role).toBe("ADMIN");
  });

  it("delegates project admin rights to org admins and transfers ownership", async () => {
    const owner = await createUser();
    const orgAdmin = await createUser({ username: "orgadmin" });
    const org = await createOrganization(owner, { name: "Beta", slug: "beta-co", type: "STARTUP", tags: [] });
    const inv = await inviteToOrganization(owner, org.id, { username: "orgadmin", role: "ADMIN" });
    await respondToInvitation(orgAdmin, inv.id, true);
    const p = await createProject(owner, { name: "Gamma", slug: "gamma-p", summary: "Org-owned project summary", category: "WEB", stage: "IDEA", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, organizationId: org.id, tech: [], topics: [] });
    // Org admin acts as project admin without being a direct member.
    await createPost(orgAdmin, { actingAs: `project:${p.id}`, type: "PROJECT_UPDATE", body: "Delegated update", imageKeys: [] });
    const member = await createUser();
    await db.projectMember.create({ data: { projectId: p.id, userId: member.id, role: "MEMBER" } });
    await expect(transferProjectOwnership(orgAdmin, p.id, member.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await transferProjectOwnership(owner, p.id, member.id);
    await expect(removeProjectMember(owner, p.id, member.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
