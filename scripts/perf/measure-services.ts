/**
 * Service-level latency baseline on the large dataset (see seed-large.ts).
 *
 *   DATABASE_URL=postgresql://…/collab_hub_perf npx tsx --conditions=react-server scripts/perf/measure-services.ts [--runs=20] [--json=out.json]
 *
 * Calls the same service functions the pages use, sequentially (no concurrency), and
 * reports p50/p95/max per path and viewer. The first call of each path is a discarded
 * warm-up. Read-only except the "write path" section, which creates real rows (posts,
 * notifications, an opportunity) in the perf database.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { db } from "../../src/server/db";
import type { Viewer } from "../../src/server/auth/types";
import { getFeed } from "../../src/server/feed";
import { searchOpportunities, searchPeople, searchPosts, searchProjects, quickSearch } from "../../src/server/search";
import { listConnections } from "../../src/server/social/graph";
import { messagesSince, unreadConversationCount, listConversations } from "../../src/server/messaging";
import { unreadNotificationCount, listNotifications } from "../../src/server/notifications";
import { recommendOpportunities, suggestPeople } from "../../src/server/matching";
import { createPost } from "../../src/server/posts";
import { createOpportunity } from "../../src/server/opportunities";
import { opportunitySchema, postSchema } from "../../src/lib/validation";

const args = new Map(process.argv.slice(2).map((a): [string, string | undefined] => { const [k = "", v] = a.replace(/^--/, "").split("="); return [k, v]; }));
const RUNS = Number(args.get("runs") ?? 20);
const JSON_OUT = args.get("json");

type Result = { path: string; viewer: string; runs: number; p50: number; p95: number; max: number; note?: string };
const results: Result[] = [];

function pct(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function measure(path: string, viewer: string, fn: () => Promise<unknown>, runs = RUNS, note?: string) {
  await fn(); // warm-up (connection pool, plan cache, Prisma query compilation)
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const r = { path, viewer, runs, p50: +pct(times, 50).toFixed(1), p95: +pct(times, 95).toFixed(1), max: +times[times.length - 1].toFixed(1), note };
  results.push(r);
  console.log(`${path.padEnd(44)} ${viewer.padEnd(8)} p50 ${String(r.p50).padStart(8)} ms  p95 ${String(r.p95).padStart(8)} ms  max ${String(r.max).padStart(8)} ms${note ? `  (${note})` : ""}`);
}

async function viewerFor(id: string): Promise<Viewer> {
  const u = await db.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, username: true, role: true, status: true, profile: { select: { displayName: true, avatarKey: true, headline: true } } } });
  return { id: u.id, email: u.email, username: u.username, role: u.role, status: u.status, emailVerified: true, displayName: u.profile?.displayName ?? u.username, avatarKey: null, avatarArt: null, headline: null };
}

async function graphSize(id: string) {
  const [connections, follows, tags] = await Promise.all([
    db.connection.count({ where: { status: "ACCEPTED", OR: [{ userAId: id }, { userBId: id }] } }),
    db.follow.count({ where: { followerId: id } }),
    db.userTag.count({ where: { userId: id } }),
  ]);
  return `${connections} connections, ${follows} follows, ${tags} tags`;
}

async function main() {
  if (args.has("only-write")) return writePaths().finally(() => db.$disconnect());
  const users = await db.user.count();
  const ids = ["u1", `u${Math.ceil(users / 100)}`, `u${Math.ceil(users / 2)}`];
  const labels = ["heavy", "p99", "median"];
  const viewers = await Promise.all(ids.map(viewerFor));
  for (let i = 0; i < ids.length; i++) console.log(`${labels[i]} viewer ${ids[i]}: ${await graphSize(ids[i])}`);
  console.log(`runs per path: ${RUNS}\n`);

  // ── Feed ──
  for (let i = 0; i < viewers.length; i++) {
    await measure("feed for-you p1", labels[i], () => getFeed(viewers[i], { mode: "for-you", page: 1 }));
    await measure("feed latest p1", labels[i], () => getFeed(viewers[i], { mode: "latest", page: 1 }));
  }
  await measure("feed latest p20 (offset)", "median", () => getFeed(viewers[2], { mode: "latest", page: 20 }));

  // ── Shell badges (rendered on every signed-in page) ──
  for (let i = 0; i < viewers.length; i++) {
    await measure("badges: unread notifications + messages", labels[i], () => Promise.all([unreadNotificationCount(viewers[i].id), unreadConversationCount(viewers[i].id)]));
  }

  // ── Search ──
  const v = viewers[2];
  await measure("search people q='react'", "median", () => searchPeople(v, { q: "react" }));
  await measure("search people q='react design lisbon'", "median", () => searchPeople(v, { q: "react design lisbon" }));
  await measure("search people q='zzqx' (no hit)", "median", () => searchPeople(v, { q: "zzqx" }));
  await measure("search projects q='climate'", "median", () => searchProjects(v, { q: "climate" }));
  await measure("search projects lookingFor=react", "median", () => searchProjects(v, { lookingFor: ["react"] }));
  await measure("search opportunities (no filter)", "median", () => searchOpportunities(v, {}));
  await measure("search opportunities q='design'", "median", () => searchOpportunities(v, { q: "design" }));
  await measure("search opportunities page 50", "median", () => searchOpportunities(v, { page: 50 }));
  await measure("search opportunities sort=match", "median", () => searchOpportunities(v, { sort: "match" }));
  await measure("search posts q='react'", "median", () => searchPosts(v, { q: "react" }));
  await measure("search posts tag=react", "median", () => searchPosts(v, { tag: "react" }));
  await measure("quick search q='react'", "median", () => quickSearch(v, "react"));
  await measure("search people q='react' (signed out)", "anon", () => searchPeople(null, { q: "react" }));

  // ── Network, messaging, notifications ──
  for (let i = 0; i < viewers.length; i++) {
    await measure("listConnections p1", labels[i], () => listConnections(viewers[i].id, { page: 1 }));
    await measure("listConversations", labels[i], () => listConversations(viewers[i]));
    await measure("listNotifications p1", labels[i], () => listNotifications(viewers[i]));
  }
  const busiest = await db.$queryRaw<{ conversationId: string; n: bigint }[]>`
    SELECT "conversationId", count(*) n FROM "Message" GROUP BY 1 ORDER BY 2 DESC LIMIT 1`;
  const conv = await db.conversation.findUniqueOrThrow({ where: { id: busiest[0].conversationId }, select: { pairKey: true } });
  const participant = await viewerFor(conv.pairKey.split(":")[0]);
  const lastMsg = await db.message.findFirstOrThrow({ where: { conversationId: busiest[0].conversationId }, orderBy: { createdAt: "desc" } });
  await measure("message poll (no new messages)", "busiest", () => messagesSince(participant, busiest[0].conversationId, lastMsg.createdAt), RUNS, `${busiest[0].n} messages in conversation`);

  // ── Matching ──
  for (let i = 0; i < viewers.length; i++) {
    await measure("recommendOpportunities", labels[i], () => recommendOpportunities(viewers[i].id));
    await measure("suggestPeople", labels[i], () => suggestPeople(viewers[i].id));
  }

  await writePaths();
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, results }, null, 2));
  await db.$disconnect();
}

/** Write paths with in-request fan-out (issue 4). Creates rows in the perf database. */
async function writePaths() {
  const topOrg = await db.$queryRaw<{ organizationId: string; n: bigint }[]>`
    SELECT "organizationId", count(*) n FROM "Follow" WHERE "organizationId" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`;
  const orgOwner = await db.organizationMember.findFirstOrThrow({ where: { organizationId: topOrg[0].organizationId, role: "OWNER" }, select: { userId: true } });
  const owner = await viewerFor(orgOwner.userId);
  await measure("createPost as org (follower fan-out)", "owner", () =>
    createPost(owner, postSchema.parse({ body: "Perf baseline update #react", actingAs: `org:${topOrg[0].organizationId}` })), 5, `${topOrg[0].n} followers, cap 500`);
  await measure("createPost as self", "owner", () => createPost(owner, postSchema.parse({ body: "Perf baseline personal post" })), 5);
  const project = await db.projectMember.findFirst({ where: { role: "OWNER", project: { visibility: "PUBLIC", status: "ACTIVE" } }, orderBy: { projectId: "asc" }, select: { projectId: true, userId: true } });
  if (project) {
    const projectOwner = await viewerFor(project.userId);
    await measure("createOpportunity OPEN (matching fan-out)", "owner", () =>
      createOpportunity(projectOwner, opportunitySchema.parse({
        title: "Perf baseline React engineer", description: "Build things with React and TypeScript for a perf baseline run.",
        category: "ENGINEERING", collaborationType: "VOLUNTEER", workMode: "REMOTE",
        skills: ["react", "typescript", "design"], topics: ["ai"], publish: "on", owner: `project:${project.projectId}`,
      })), 5);
  }
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
