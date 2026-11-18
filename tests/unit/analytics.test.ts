import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personalAnalytics } from "@/server/analytics";
import { db } from "@/server/db";

vi.mock("@/server/db", () => ({ db: {
  follow: { count: vi.fn() }, connection: { count: vi.fn() }, reaction: { count: vi.fn() },
  comment: { count: vi.fn() }, post: { count: vi.fn(), findMany: vi.fn() },
} }));
const actor = { id: "member-a", username: "ana", role: "USER" as const, status: "ACTIVE" as const, emailVerified: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  vi.mocked(db.follow.count).mockResolvedValue(5);
  vi.mocked(db.connection.count).mockResolvedValue(4);
  vi.mocked(db.reaction.count).mockResolvedValue(6);
  vi.mocked(db.comment.count).mockResolvedValue(2);
  vi.mocked(db.post.count).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
  vi.mocked(db.post.findMany).mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("private personal analytics", () => {
  it("keeps totals separate from 30-day metrics and sums engagement", async () => {
    const data = await personalAnalytics(actor);
    expect(data).toMatchObject({ followers: 5, connections: 4, posts: 3, likes: 6, comments: 2, shares: 1, interactions: 9 });
    expect(data.since.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(data.until.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
  it("scopes content to the actor and excludes entity posts, self actions and unpublished content", async () => {
    await personalAnalytics(actor);
    expect(db.post.count).toHaveBeenNthCalledWith(1, { where: expect.objectContaining({ authorId: actor.id, projectId: null, organizationId: null, status: "PUBLISHED" }) });
    expect(db.reaction.count).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: {not: actor.id}, post: {authorId: actor.id, projectId: null, organizationId: null, status:"PUBLISHED"}, createdAt: {gte: new Date("2026-10-12T12:00:00Z"), lte: new Date("2026-11-11T12:00:00Z")} }) });
    expect(db.comment.count).toHaveBeenCalledWith({where: expect.objectContaining({status:"PUBLISHED", authorId: {not: actor.id}})});
    expect(db.post.count).toHaveBeenNthCalledWith(2, {where: expect.objectContaining({repostOf: {authorId:actor.id, projectId:null, organizationId:null, status:"PUBLISHED"}, authorId:{not:actor.id}, status:"PUBLISHED"})});
  });
  it("shows zero activity without inventing views or impressions", async () => {
    vi.mocked(db.reaction.count).mockResolvedValue(0); vi.mocked(db.comment.count).mockResolvedValue(0);
    vi.mocked(db.post.count).mockReset().mockResolvedValue(0);
    const data = await personalAnalytics(actor);
    expect(data.interactions).toBe(0); expect(data.posts).toBe(0); expect(data).not.toHaveProperty("impressions"); expect(data).not.toHaveProperty("profileViews");
  });
});
