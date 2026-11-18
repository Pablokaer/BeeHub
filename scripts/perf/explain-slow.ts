/**
 * Captures the exact SQL Prisma sends for the slowest service paths and records
 * EXPLAIN (ANALYZE, BUFFERS) for every statement slower than a threshold.
 *
 *   DATABASE_URL=postgresql://…/collab_hub_perf npx tsx --conditions=react-server scripts/perf/explain-slow.ts [--out=docs/audit/evidence/explain] [--min-ms=50]
 *
 * Read-only apart from the digest/tag-usage section, which runs inside a transaction that
 * is rolled back. Use it again after each optimization to produce "after" plans.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const args = new Map(process.argv.slice(2).map((a): [string, string | undefined] => { const [k = "", v] = a.replace(/^--/, "").split("="); return [k, v]; }));
const OUT = args.get("out") ?? "docs/audit/evidence/explain";
const MIN_MS = Number(args.get("min-ms") ?? 50);
const url = process.env.DATABASE_URL!;

type Captured = { label: string; sql: string; params: unknown[]; ms: number };
const captured: Captured[] = [];
let currentLabel = "";

// Install a logging client as the app's shared Prisma client before services load.
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [{ emit: "event", level: "query" }] });
client.$on("query", (e) => {
  if (e.duration >= MIN_MS) captured.push({ label: currentLabel, sql: e.query, params: JSON.parse(e.params), ms: e.duration });
});
(globalThis as unknown as { prisma: unknown }).prisma = client;

async function main() {
  const { getFeed } = await import("../../src/server/feed");
  const search = await import("../../src/server/search");
  const { listConnections } = await import("../../src/server/social/graph");
  const matching = await import("../../src/server/matching");

  const viewer = async (id: string) => {
    const u = await client.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, username: true, role: true, status: true } });
    return { ...u, emailVerified: true, displayName: u.username, avatarKey: null, avatarArt: null, headline: null };
  };
  const median = await viewer("u25000");
  const heavy = await viewer("u1");

  const run = async (label: string, fn: () => Promise<unknown>) => {
    currentLabel = label;
    await fn();
    await fn(); // second run: warm cache, this is the one we keep timings for
  };
  await run("feed-latest-heavy", () => getFeed(heavy, { mode: "latest" }));
  await run("feed-latest-p20", () => getFeed(median, { mode: "latest", page: 20 }));
  await run("feed-for-you-heavy", () => getFeed(heavy, { mode: "for-you" }));
  await run("search-posts-q", () => search.searchPosts(median, { q: "react" }));
  await run("search-posts-tag", () => search.searchPosts(median, { tag: "react" }));
  await run("search-people-q", () => search.searchPeople(median, { q: "react design lisbon" }));
  await run("search-projects-q", () => search.searchProjects(median, { q: "climate" }));
  await run("search-opportunities-q", () => search.searchOpportunities(median, { q: "design" }));
  await run("search-opportunities-match", () => search.searchOpportunities(median, { sort: "match" }));
  await run("list-connections-heavy", () => listConnections("u1", { page: 1 }));
  await run("recommend-opportunities", () => matching.recommendOpportunities("u500"));
  await run("suggest-people-heavy", () => matching.suggestPeople("u1"));

  // Keep the slowest capture per (label, statement shape).
  const best = new Map<string, Captured>();
  for (const c of captured) {
    const key = `${c.label}|${c.sql.slice(0, 120)}`;
    const prev = best.get(key);
    if (!prev || c.ms > prev.ms) best.set(key, c);
  }

  const pool = new pg.Client({ connectionString: url });
  await pool.connect();
  mkdirSync(OUT, { recursive: true });
  const index: string[] = ["| label | prisma ms | plan file |", "| --- | --- | --- |"];
  let i = 0;
  for (const c of [...best.values()].sort((a, b) => b.ms - a.ms)) {
    i++;
    const file = `${String(i).padStart(2, "0")}-${c.label}.txt`;
    let plan: string;
    try {
      const res = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, SETTINGS) ${c.sql}`, c.params as unknown[]);
      plan = res.rows.map((r: Record<string, string>) => r["QUERY PLAN"]).join("\n");
    } catch (e) {
      plan = `EXPLAIN failed: ${(e as Error).message}`;
    }
    writeFileSync(path.join(OUT, file), `-- ${c.label} (${c.ms} ms in Prisma)\n-- params: ${JSON.stringify(c.params).slice(0, 2000)}\n${c.sql}\n\n${plan}\n`);
    index.push(`| ${c.label} | ${c.ms} | ${file} |`);
  }

  // Maintenance statements that aren't on a read path: digest scan and tag-usage recount.
  await pool.query("BEGIN");
  const extra: [string, string][] = [
    ["digest-queued-scan", `SELECT id, "userId" FROM "Notification" WHERE "emailStatus" = 'QUEUED' ORDER BY "createdAt" ASC LIMIT 5000`],
    ["tag-usage-recount-hot-tag", `UPDATE "Tag" t SET "usageCount" =
      (SELECT count(*) FROM "UserTag" x WHERE x."tagId" = t.id) + (SELECT count(*) FROM "ProjectTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "OrganizationTag" x WHERE x."tagId" = t.id) + (SELECT count(*) FROM "OpportunityTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "PostTag" x WHERE x."tagId" = t.id) WHERE t.id = ANY(ARRAY['t1','t2','t3'])`],
  ];
  for (const [label, sql] of extra) {
    i++;
    const res = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
    const file = `${String(i).padStart(2, "0")}-${label}.txt`;
    writeFileSync(path.join(OUT, file), `-- ${label}\n${sql}\n\n${res.rows.map((r: Record<string, string>) => r["QUERY PLAN"]).join("\n")}\n`);
    index.push(`| ${label} | (direct) | ${file} |`);
  }
  await pool.query("ROLLBACK");
  writeFileSync(path.join(OUT, "INDEX.md"), `# Slow statements (≥ ${MIN_MS} ms), captured ${new Date().toISOString()}\n\n${index.join("\n")}\n`);
  console.log(index.join("\n"));
  await pool.end();
  await client.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await client.$disconnect();
  process.exit(1);
});
