import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  areConnected, blockUser, cancelConnectionRequest, follow, listConnectionRequests, mutualConnections,
  removeConnection, respondToConnectionRequest, respondToFollowRequest, sendConnectionRequest, unfollow,
} from "@/server/social/graph";
import { addComment, createPost, deletePost, getPost, listComments, toggleLike, toggleSave, listSavedPosts } from "@/server/posts";
import { getFeed } from "@/server/feed";
import { createProject } from "@/server/projects";
import { canMessage } from "@/server/messaging";
import { getPublicProfile } from "@/server/profiles";
import { fileReport, resolveReport } from "@/server/moderation";
import { createUser, resetDb, viewerOf } from "../helpers";

const post = (body: string, extra: Record<string, unknown> = {}) => ({ actingAs: "user", type: "TEXT" as const, body, imageKeys: [], ...extra });

describe("Scenario D: connections and follows", () => {
  beforeEach(resetDb);

  it("handles requests, duplicates, mirrored requests and removal", async () => {
    const a = await createUser({ username: "anna" });
    const b = await createUser({ username: "ben" });
    const c = await createUser({ username: "cleo" });
    await sendConnectionRequest(a, b.id, "Hi Ben!");
    await expect(sendConnectionRequest(a, b.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await listConnectionRequests(b)).incoming[0].user.username).toBe("anna");
    expect(await db.notification.count({ where: { userId: b.id, type: "CONNECTION_REQUEST" } })).toBe(1);
    await expect(respondToConnectionRequest(a, b.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" }); // requester can't accept
    await respondToConnectionRequest(b, a.id, true);
    expect(await areConnected(a.id, b.id)).toBe(true);
    expect(await db.connection.count()).toBe(1);

    // Mirrored pending request becomes an acceptance instead of a contradiction.
    await sendConnectionRequest(c, a.id);
    const r = await sendConnectionRequest(a, c.id);
    expect(r.status).toBe("accepted");
    expect((await mutualConnections(b.id, c.id)).count).toBe(1);

    await removeConnection(a, b.id);
    expect(await areConnected(a.id, b.id)).toBe(false);
    await sendConnectionRequest(a, b.id);
    await cancelConnectionRequest(a, b.id);
    expect(await db.connection.count({ where: { status: "PENDING" } })).toBe(0);
    // Declined requests have a cooldown for the requester.
    await sendConnectionRequest(a, b.id);
    await respondToConnectionRequest(b, a.id, false);
    await expect(sendConnectionRequest(a, b.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(sendConnectionRequest(a, a.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("follows people, projects and orgs, with approval when required", async () => {
    const a = await createUser();
    const b = await createUser();
    await follow(a, { userId: b.id });
    expect(await follow(a, { userId: b.id })).toBe("ACTIVE"); // idempotent
    expect(await db.follow.count()).toBe(1);
    await unfollow(a, { userId: b.id });
    await db.profile.update({ where: { userId: b.id }, data: { followApproval: true } });
    expect(await follow(a, { userId: b.id })).toBe("PENDING");
    await respondToFollowRequest(b, a.id, true);
    expect((await db.follow.findFirst({ where: { followerId: a.id } }))?.status).toBe("ACTIVE");
    const p = await createProject(b, { name: "Proj", slug: "proj-x", summary: "A followable project summary", category: "WEB", stage: "IDEA", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, tech: [], topics: [] });
    await follow(a, { projectId: p.id });
    expect(await db.follow.count({ where: { followerId: a.id } })).toBe(2);
  });

  it("blocking removes relationships and hides profiles and messaging", async () => {
    const a = await createUser({ username: "blocker" });
    const b = await createUser({ username: "blocked" });
    await sendConnectionRequest(a, b.id);
    await respondToConnectionRequest(b, a.id, true);
    await follow(b, { userId: a.id });
    await blockUser(a, b.id);
    expect(await areConnected(a.id, b.id)).toBe(false);
    expect(await db.follow.count()).toBe(0);
    expect(await getPublicProfile(viewerOf(b), "blocker")).toBeNull();
    expect(await canMessage(b.id, a.id)).toMatchObject({ allowed: false });
    await expect(sendConnectionRequest(b, a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Scenario F: posts and interactions", () => {
  beforeEach(resetDb);

  it("publishes as a project with mentions, likes, comments, replies and shares", async () => {
    const owner = await createUser({ username: "owner" });
    const ana = await createUser({ username: "ana" });
    const bea = await createUser({ username: "bea" });
    const p = await createProject(owner, { name: "Orbit", slug: "orbit", summary: "Satellite data made simple", category: "RESEARCH", stage: "MVP", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, tech: [], topics: [] });
    await follow(bea, { projectId: p.id });
    await expect(createPost(ana, post("not mine", { actingAs: `project:${p.id}` }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    const update = await createPost(owner, post("v2 is live! Thanks @ana for testing #Launch #AI", { actingAs: `project:${p.id}`, type: "PROJECT_UPDATE" }));
    expect(await db.notification.count({ where: { userId: ana.id, type: "MENTION" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: bea.id, type: "ENTITY_UPDATE" } })).toBe(1);
    expect(await db.postTag.count({ where: { postId: update.id } })).toBe(2);

    // Likes are idempotent toggles with consistent counters.
    await toggleLike(ana, update.id);
    await toggleLike(bea, update.id);
    await toggleLike(bea, update.id);
    expect((await db.post.findUnique({ where: { id: update.id } }))?.likeCount).toBe(1);

    const c1 = await addComment(ana, { postId: update.id, body: "Congrats! cc @bea" });
    const reply = await addComment(bea, { postId: update.id, parentId: c1.id, body: "Agreed!" });
    const nested = await addComment(owner, { postId: update.id, parentId: reply.id, body: "Thank you both" });
    expect(nested.parentId).toBe(c1.id); // one-level threading
    const thread = await listComments(viewerOf(owner), update.id);
    expect(thread).toHaveLength(1);
    expect(thread[0].replies).toHaveLength(2);
    expect(await db.notification.count({ where: { userId: ana.id, type: "COMMENT_REPLY" } })).toBe(2);

    // Share and quote.
    await createPost(bea, post("", { repostOfId: update.id }));
    await expect(createPost(bea, post("", { repostOfId: update.id }))).rejects.toMatchObject({ code: "CONFLICT" });
    await createPost(bea, post("Worth reading", { repostOfId: update.id }));
    const fresh = await getPost(viewerOf(ana), update.id);
    expect(fresh).toMatchObject({ likeCount: 1, commentCount: 3, shareCount: 2, liked: true });

    await toggleSave(ana, update.id);
    expect((await listSavedPosts(viewerOf(ana))).map((x) => x.id)).toEqual([update.id]);

    await expect(deletePost(ana, update.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deletePost(owner, update.id);
    expect(await getPost(viewerOf(ana), update.id)).toBeNull();
  });

  it("ranks the feed by network, follows and interests", async () => {
    const me = await createUser();
    const friend = await createUser();
    const stranger = await createUser();
    await sendConnectionRequest(me, friend.id);
    await respondToConnectionRequest(friend, me.id, true);
    await createPost(stranger, post("Random thoughts from a stranger"));
    const fp = await createPost(friend, post("Update from my friend"));
    const feed = await getFeed(viewerOf(me));
    expect(feed.items[0].post.id).toBe(fp.id);
    expect(feed.items[0].reason).toBe("From your network");
    expect(feed.items).toHaveLength(2);
    const latest = await getFeed(viewerOf(me), { mode: "latest" });
    expect(latest.items.map((i) => i.post.id)).toEqual([fp.id]);
  });

  it("moderation removes reported content from public access", async () => {
    const author = await createUser();
    const reporter = await createUser();
    const mod = await createUser({ role: "MODERATOR" });
    const p = await createPost(author, post("spammy spam"));
    const r = await fileReport(reporter, { targetType: "POST", targetId: p.id, reason: "SPAM" });
    await expect(fileReport(reporter, { targetType: "POST", targetId: p.id, reason: "SPAM" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(resolveReport(reporter, r.id, "remove_content")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await resolveReport(mod, r.id, "remove_content", "spam");
    expect(await getPost(viewerOf(reporter), p.id)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "moderation.remove_content" } })).toBe(1);
  });
});
