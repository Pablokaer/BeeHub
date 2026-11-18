/**
 * End-to-end HTTP latency baseline against a running production server on the large
 * dataset. Measures time to first byte and time to the end of the streamed body
 * (Suspense boundaries resolved), signed in with a perf session (seed-large.ts).
 *
 *   npx next start -p 3300   (with DATABASE_URL pointing at collab_hub_perf)
 *   npx tsx scripts/perf/measure-http.ts [--base=http://localhost:3300] [--runs=20] [--concurrency=1] [--json=out.json]
 *
 * This is a lightweight stand-in until the k6 suite (M2); numbers are from one laptop
 * with app and Postgres on the same machine, so treat them as relative, not absolute.
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const args = new Map(process.argv.slice(2).map((a): [string, string | undefined] => { const [k = "", v] = a.replace(/^--/, "").split("="); return [k, v]; }));
const BASE = args.get("base") ?? "http://localhost:3300";
const RUNS = Number(args.get("runs") ?? 20);
const CONCURRENCY = Number(args.get("concurrency") ?? 1);
const JSON_OUT = args.get("json");
const VIEWER = args.get("viewer") ?? "u25000";

type Target = { name: string; path: string; auth: boolean };

async function pickIds() {
  // Resolve a busy conversation for the viewer through the API surface would need ids;
  // the seed uses predictable ids, so pick well-known ones.
  return { conversation: args.get("conversation") ?? "cv1" };
}

function pct(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function hit(path: string, auth: boolean) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, { headers: auth ? { cookie: `ch_session=perf-token-${VIEWER}` } : {}, redirect: "manual" });
  const ttfb = performance.now() - t0;
  await res.arrayBuffer();
  return { status: res.status, ttfb, total: performance.now() - t0 };
}

async function main() {
  const ids = await pickIds();
  const targets: Target[] = [
    { name: "landing /", path: "/", auth: false },
    { name: "feed (for you)", path: "/feed", auth: true },
    { name: "feed (latest)", path: "/feed?mode=latest", auth: true },
    { name: "discover q=react", path: "/discover?q=react", auth: true },
    { name: "discover people q=react", path: "/discover?type=people&q=react", auth: true },
    { name: "opportunities", path: "/opportunities", auth: true },
    { name: "opportunities sort=match", path: "/opportunities?sort=match", auth: true },
    { name: "opportunities (signed out)", path: "/opportunities", auth: false },
    { name: "profile /u/user1 (heavy)", path: "/u/user1", auth: true },
    { name: "profile /u/user25000", path: "/u/user25000", auth: true },
    { name: "connections /u/user1/connections", path: "/u/user1/connections", auth: true },
    { name: "project /p/project-1", path: "/p/project-1", auth: true },
    { name: "org /o/org-1", path: "/o/org-1", auth: true },
    { name: "opportunity /opportunities/op1", path: "/opportunities/op1", auth: true },
    { name: "tag /tags/react", path: "/tags/react", auth: true },
    { name: "notifications", path: "/notifications", auth: true },
    { name: "messages list", path: "/messages", auth: true },
    { name: "message poll API", path: `/api/messages/${ids.conversation}?after=${encodeURIComponent(new Date().toISOString())}`, auth: true },
    { name: "missing profile /u/nope", path: "/u/does-not-exist-404", auth: false },
  ];

  const results = [];
  for (const t of targets) {
    await hit(t.path, t.auth); // warm-up
    const ttfbs: number[] = [];
    const totals: number[] = [];
    const statuses = new Set<number>();
    let next = 0;
    const worker = async () => {
      while (next < RUNS) {
        next++;
        const r = await hit(t.path, t.auth);
        ttfbs.push(r.ttfb);
        totals.push(r.total);
        statuses.add(r.status);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    ttfbs.sort((a, b) => a - b);
    totals.sort((a, b) => a - b);
    const row = {
      name: t.name, path: t.path, status: [...statuses].join(","), runs: RUNS, concurrency: CONCURRENCY,
      ttfbP50: +pct(ttfbs, 50).toFixed(0), totalP50: +pct(totals, 50).toFixed(0), totalP95: +pct(totals, 95).toFixed(0), totalMax: +totals[totals.length - 1].toFixed(0),
    };
    results.push(row);
    console.log(`${row.name.padEnd(36)} ${row.status.padEnd(8)} ttfb p50 ${String(row.ttfbP50).padStart(6)} ms   total p50 ${String(row.totalP50).padStart(6)} ms  p95 ${String(row.totalP95).padStart(6)} ms  max ${String(row.totalMax).padStart(6)} ms`);
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, viewer: VIEWER, runs: RUNS, concurrency: CONCURRENCY, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
