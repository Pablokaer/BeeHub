/**
 * Large synthetic dataset for performance work (M0 baseline, k6 later).
 *
 *   DATABASE_URL=postgresql://…/collab_hub_perf npx tsx scripts/perf/seed-large.ts [--scale=1]
 *
 * scale=1 ≈ 50k users, 5k organizations, 20k projects, 50k opportunities, 1M posts,
 * ~1.2M connections, ~1.4M follows, 2M reactions, 500k comments, 1M messages, 2M notifications.
 * Data is generated in SQL (generate_series) so the full set loads in minutes.
 *
 * Distributions are skewed (power law) on purpose: low ids are "celebrities" with very
 * large graphs, which is what breaks unbounded queries. Reference viewers used by the
 * measurements: u1 (heaviest graph), u500 (p99), u25000 (median) at scale 1 (ids scale with --scale). Each gets a session
 * whose raw token is `perf-token-<id>` (cookie `ch_session`).
 *
 * Destructive: truncates every table. Refuses to run unless the database name ends in
 * `_perf` (override with --force).
 *
 * Note: denormalized counters (likeCount, commentCount, Tag.usageCount) are filled with
 * plausible values, not recomputed from the generated rows.
 */
import { config } from "dotenv";
import pg from "pg";
import { scryptSync, randomBytes } from "node:crypto";

config({ quiet: true });

const args = new Map(process.argv.slice(2).map((a): [string, string | undefined] => { const [k = "", v] = a.replace(/^--/, "").split("="); return [k, v]; }));
const SCALE = Number(args.get("scale") ?? 1);
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith("_perf") && !args.has("force")) {
  throw new Error(`Refusing to truncate "${dbName}": the database name must end in _perf (or pass --force).`);
}

const n = (x: number) => Math.max(1, Math.round(x * SCALE));
const USERS = n(50_000);
const ORGS = n(5_000);
const PROJECTS = n(20_000);
const OPPS = n(50_000);
const POSTS = n(1_000_000);
const TAGS = 2_000;
const CONVS = n(100_000);

// A shared password for every synthetic account: "perf-password-2026" (cheap scrypt cost;
// verifyPassword reads the parameters from the stored hash).
const salt = randomBytes(16);
const PASSWORD_HASH = ["scrypt", 1024, 8, 1, salt.toString("base64"), scryptSync("perf-password-2026", salt, 64, { N: 1024, r: 8, p: 1 }).toString("base64")].join("$");

const WORDS = `react typescript python design product marketing research startup climate health education fintech
open-source mobile web data machine-learning ai backend frontend devops cloud kubernetes postgres rust go java kotlin
swift flutter figma ux ui accessibility community volunteer mentor cofounder freelance remote lisbon porto berlin london
nonprofit impact games blockchain hardware robotics iot security privacy analytics growth sales partnership launch mvp
prototype scaling hiring internship academic thesis paper grant funding seed angel equity api sdk platform marketplace
app dashboard editor compiler database search ranking recommendation feed messaging notifications payments ledger
sustainability energy mobility food agriculture music video podcast writing content seo brand illustration animation
3d unity unreal godot testing qa automation pipeline infra monitoring observability graphql nextjs node django rails
projeto equipa colaboracao voluntariado estagio investigacao saude educacao clima comunidade inovacao`.split(/\s+/).filter(Boolean);

const wordsSql = `ARRAY[${WORDS.map((w) => `'${w}'`).join(",")}]::text[]`;
/** n random words; `seed` must reference an outer column so Postgres evaluates it per row. */
const text = (count: number, seed: string) =>
  `(SELECT string_agg((${wordsSql})[1 + floor(random() * ${WORDS.length})::int], ' ') FROM generate_series(1, ${count}) WHERE ${seed} IS NOT NULL)`;
/** Skewed pick in [1, max]: low ids are picked far more often. */
const skew = (max: number, power = 2.5) => `(1 + floor(${max} * power(random(), ${power})))::int`;
const uniform = (max: number) => `(1 + floor(${max} * random()))::int`;
const pickEnum = (values: string[], type: string) => `((ARRAY[${values.map((v) => `'${v}'`).join(",")}])[1 + floor(random() * ${values.length})::int])::"${type}"`;

const steps: [string, string][] = [
  ["truncate", `DO $$ DECLARE r record; BEGIN
     EXECUTE (SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' RESTART IDENTITY CASCADE'
              FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations');
   END $$`],

  ["tags", `INSERT INTO "Tag" (id, slug, name, category, "usageCount")
    SELECT 't' || i,
           CASE WHEN i <= ${WORDS.length} THEN (${wordsSql})[i] ELSE 'topic-' || i END,
           CASE WHEN i <= ${WORDS.length} THEN initcap((${wordsSql})[i]) ELSE 'Topic ' || i END,
           CASE WHEN i % 3 = 0 THEN 'TECHNOLOGY' WHEN i % 3 = 1 THEN 'SKILL' ELSE 'OTHER' END::"TagCategory",
           (100000 / i)::int
    FROM generate_series(1, ${TAGS}) i`],

  ["users", `INSERT INTO "User" (id, email, username, "passwordHash", "emailVerifiedAt", status, role, "createdAt", "updatedAt")
    SELECT 'u' || i, 'user' || i || '@perf.local', 'user' || i, '${PASSWORD_HASH}', now(),
           CASE WHEN i % 200 = 7 THEN 'DEACTIVATED' ELSE 'ACTIVE' END::"UserStatus",
           CASE WHEN i <= 5 THEN 'ADMIN' ELSE 'USER' END::"SiteRole",
           now() - (random() * interval '730 days'), now()
    FROM generate_series(1, ${USERS}) i`],

  ["profiles", `INSERT INTO "Profile" ("userId", "displayName", headline, bio, location, availability, "experienceLevel",
                         "preferredWorkModes", "preferredCollabs", visibility, searchable, "messagePermission", "updatedAt")
    SELECT 'u' || i, initcap(${text(2, "i")}) || ' ' || i, ${text(6, "i")}, ${text(40, "i")},
           (ARRAY['Lisbon','Porto','Berlin','London','Madrid','Paris','Remote','São Paulo'])[1 + floor(random() * 8)::int],
           ARRAY[${pickEnum(["OPEN_TO_COLLABORATE", "LOOKING_FOR_PROJECTS", "OPEN_TO_PAID_WORK", "OPEN_TO_VOLUNTEER", "LOOKING_FOR_COFOUNDERS", "OPEN_TO_NETWORKING"], "Availability")}],
           ${pickEnum(["BEGINNER", "JUNIOR", "MID", "SENIOR", "EXPERT"], "ExperienceLevel")},
           ARRAY[${pickEnum(["REMOTE", "HYBRID", "ONSITE"], "WorkMode")}],
           ARRAY[${pickEnum(["PAID", "FREELANCE", "VOLUNTEER", "COFOUNDER", "MENTORSHIP"], "CollaborationType")}],
           CASE WHEN i % 10 = 0 THEN 'MEMBERS' ELSE 'PUBLIC' END::"ProfileVisibility",
           i % 25 <> 0,
           CASE WHEN i % 4 = 0 THEN 'CONNECTIONS' ELSE 'EVERYONE' END::"MessagePermission",
           now() - (random() * interval '365 days')
    FROM generate_series(1, ${USERS}) i`],

  ["user handles", `INSERT INTO "Handle" (handle, "userId") SELECT 'user' || i, 'u' || i FROM generate_series(1, ${USERS}) i`],

  ["user tags", `INSERT INTO "UserTag" ("userId", "tagId", kind)
    SELECT 'u' || u, 't' || ${skew(TAGS, 3)}, CASE WHEN k <= 5 THEN 'SKILL' ELSE 'INTEREST' END::"UserTagKind"
    FROM generate_series(1, ${USERS}) u, generate_series(1, 8) k
    ON CONFLICT DO NOTHING`],

  ["organizations", `INSERT INTO "Organization" (id, slug, name, type, tagline, description, industry, location, status, "createdById", "createdAt", "updatedAt")
    SELECT 'o' || i, 'org-' || i, initcap(${text(2, "i")}) || ' Org ' || i,
           ${pickEnum(["COMPANY", "STARTUP", "NONPROFIT", "ASSOCIATION", "COMMUNITY", "ACADEMIC"], "OrgType")},
           ${text(6, "i")}, ${text(60, "i")}, initcap(${text(1, "i")}), 'Lisbon',
           CASE WHEN i % 40 = 0 THEN 'ARCHIVED' ELSE 'ACTIVE' END::"EntityStatus",
           'u' || ${skew(USERS)}, now() - (random() * interval '700 days'), now() - (random() * interval '200 days')
    FROM generate_series(1, ${ORGS}) i`],

  ["org handles", `INSERT INTO "Handle" (handle, "organizationId") SELECT 'org-' || i, 'o' || i FROM generate_series(1, ${ORGS}) i`],

  ["org members", `INSERT INTO "OrganizationMember" ("organizationId", "userId", role)
    SELECT id, "createdById", 'OWNER' FROM "Organization"
    UNION ALL
    SELECT 'o' || ${uniform(ORGS)}, 'u' || ${skew(USERS, 1.5)}, ${pickEnum(["ADMIN", "EDITOR", "MEMBER", "MEMBER"], "MemberRole")}
    FROM generate_series(1, ${ORGS * 4})
    ON CONFLICT DO NOTHING`],

  ["org tags", `INSERT INTO "OrganizationTag" ("organizationId", "tagId")
    SELECT 'o' || o, 't' || ${skew(TAGS, 3)} FROM generate_series(1, ${ORGS}) o, generate_series(1, 4) k ON CONFLICT DO NOTHING`],

  ["projects", `INSERT INTO "Project" (id, slug, name, summary, description, goals, needs, category, stage, visibility, "isOpenSource",
                         "acceptsBeginners", status, "createdById", "organizationId", "createdAt", "updatedAt")
    SELECT 'p' || i, 'project-' || i, initcap(${text(2, "i")}) || ' ' || i, ${text(12, "i")}, ${text(80, "i")}, ${text(20, "i")}, ${text(15, "i")},
           ${pickEnum(["AI_ML", "WEB", "MOBILE", "GAMES", "DEVTOOLS", "OPEN_SOURCE", "FINTECH", "HEALTH", "EDUCATION", "SOCIAL_IMPACT"], "ProjectCategory")},
           ${pickEnum(["IDEA", "PLANNING", "PROTOTYPE", "IN_DEVELOPMENT", "MVP", "LAUNCHED"], "ProjectStage")},
           CASE WHEN i % 10 = 0 THEN 'PRIVATE' ELSE 'PUBLIC' END::"ProjectVisibility",
           i % 3 = 0, i % 4 = 0,
           CASE WHEN i % 20 = 0 THEN 'ARCHIVED' ELSE 'ACTIVE' END::"EntityStatus",
           'u' || ${skew(USERS)},
           CASE WHEN i % 10 < 3 THEN 'o' || ${skew(ORGS, 2)} END,
           now() - (random() * interval '700 days'), now() - (random() * interval '200 days')
    FROM generate_series(1, ${PROJECTS}) i`],

  ["project handles", `INSERT INTO "Handle" (handle, "projectId") SELECT 'project-' || i, 'p' || i FROM generate_series(1, ${PROJECTS}) i`],

  ["project members", `INSERT INTO "ProjectMember" ("projectId", "userId", role)
    SELECT id, "createdById", 'OWNER' FROM "Project"
    UNION ALL
    SELECT 'p' || ${uniform(PROJECTS)}, 'u' || ${skew(USERS, 1.5)}, ${pickEnum(["ADMIN", "EDITOR", "MEMBER", "MEMBER"], "MemberRole")}
    FROM generate_series(1, ${PROJECTS * 3})
    ON CONFLICT DO NOTHING`],

  ["project tags", `INSERT INTO "ProjectTag" ("projectId", "tagId", kind)
    SELECT 'p' || p, 't' || ${skew(TAGS, 3)}, CASE WHEN k <= 4 THEN 'TECH' ELSE 'TOPIC' END::"ProjectTagKind"
    FROM generate_series(1, ${PROJECTS}) p, generate_series(1, 6) k ON CONFLICT DO NOTHING`],

  ["opportunities", `INSERT INTO "Opportunity" (id, title, description, category, "collaborationType", "workMode", location, "experienceLevel",
                         "compensationType", "isPaid", deadline, status, "publishedAt", "createdById", "projectId", "organizationId",
                         "createdAt", "updatedAt")
    SELECT 'op' || i, initcap(${text(4, "i")}), ${text(70, "i")},
           ${pickEnum(["ENGINEERING", "DESIGN", "PRODUCT", "MARKETING", "RESEARCH", "CONTENT", "PARTNERSHIP"], "OpportunityCategory")},
           ${pickEnum(["PAID", "FREELANCE", "VOLUNTEER", "PROJECT_PARTNERSHIP", "COFOUNDER", "INTERNSHIP", "MENTORSHIP"], "CollaborationType")},
           ${pickEnum(["REMOTE", "REMOTE", "HYBRID", "ONSITE"], "WorkMode")}, 'Lisbon',
           ${pickEnum(["BEGINNER", "JUNIOR", "MID", "SENIOR"], "ExperienceLevel")},
           'NONE', i % 3 = 0,
           CASE WHEN i % 10 < 3 THEN now() + (random() * interval '120 days') - interval '30 days' END,
           (CASE WHEN i % 20 < 12 THEN 'OPEN' WHEN i % 20 < 16 THEN 'CLOSED' WHEN i % 20 < 18 THEN 'FILLED' WHEN i % 20 = 18 THEN 'DRAFT' ELSE 'ARCHIVED' END)::"OpportunityStatus",
           CASE WHEN i % 20 <> 18 THEN now() - (power(random(), 2) * interval '365 days') END,
           'u' || ${skew(USERS)},
           CASE WHEN i % 10 < 6 THEN 'p' || ${uniform(PROJECTS)} END,
           CASE WHEN i % 10 IN (6, 7) THEN 'o' || ${uniform(ORGS)} END,
           now() - interval '400 days', now()
    FROM generate_series(1, ${OPPS}) i`],

  ["opportunity tags", `INSERT INTO "OpportunityTag" ("opportunityId", "tagId", kind)
    SELECT 'op' || o, 't' || ${skew(TAGS, 3)}, CASE WHEN k <= 5 THEN 'SKILL' ELSE 'TOPIC' END::"OpportunityTagKind"
    FROM generate_series(1, ${OPPS}) o, generate_series(1, 7) k ON CONFLICT DO NOTHING`],

  ["applications", `INSERT INTO "Application" (id, "opportunityId", "applicantId", message, status, "createdAt", "updatedAt")
    SELECT 'a' || i, 'op' || ${skew(OPPS, 2)}, 'u' || ${uniform(USERS)}, ${text(25, "i")},
           ${pickEnum(["RECEIVED", "IN_REVIEW", "CONTACTED", "ACCEPTED", "REJECTED", "WITHDRAWN"], "ApplicationStatus")},
           now() - (random() * interval '300 days'), now()
    FROM generate_series(1, ${n(200_000)}) i ON CONFLICT DO NOTHING`],

  ["connections", `INSERT INTO "Connection" ("userAId", "userBId", "requesterId", status, "createdAt", "respondedAt")
    SELECT least(a, b), greatest(a, b), least(a, b),
           CASE WHEN random() < 0.9 THEN 'ACCEPTED' ELSE 'PENDING' END::"ConnectionStatus",
           now() - (random() * interval '700 days'), now()
    FROM (SELECT 'u' || ${skew(USERS)} AS a, 'u' || ${uniform(USERS)} AS b FROM generate_series(1, ${n(1_300_000)})) x
    WHERE a <> b ON CONFLICT DO NOTHING`],

  ["follows (people)", `INSERT INTO "Follow" (id, "followerId", "userId", status, "createdAt")
    SELECT 'fu' || row_number() OVER (), f, t, 'ACTIVE', now() - (random() * interval '500 days')
    FROM (SELECT DISTINCT ON (f, t) f, t FROM (SELECT 'u' || ${uniform(USERS)} AS f, 'u' || ${skew(USERS, 3)} AS t FROM generate_series(1, ${n(1_000_000)})) y WHERE f <> t) x
    ON CONFLICT DO NOTHING`],

  ["follows (projects)", `INSERT INTO "Follow" (id, "followerId", "projectId", status, "createdAt")
    SELECT 'fp' || row_number() OVER (), f, t, 'ACTIVE', now() - (random() * interval '500 days')
    FROM (SELECT DISTINCT 'u' || ${uniform(USERS)} AS f, 'p' || ${skew(PROJECTS, 3)} AS t FROM generate_series(1, ${n(300_000)})) x
    ON CONFLICT DO NOTHING`],

  ["follows (orgs)", `INSERT INTO "Follow" (id, "followerId", "organizationId", status, "createdAt")
    SELECT 'fo' || row_number() OVER (), f, t, 'ACTIVE', now() - (random() * interval '500 days')
    FROM (SELECT DISTINCT 'u' || ${uniform(USERS)} AS f, 'o' || ${skew(ORGS, 3)} AS t FROM generate_series(1, ${n(120_000)})) x
    ON CONFLICT DO NOTHING`],

  ["blocks", `INSERT INTO "Block" ("blockerId", "blockedId")
    SELECT 'u' || ${uniform(USERS)}, 'u' || ${uniform(USERS)} FROM generate_series(1, ${n(5_000)}) ON CONFLICT DO NOTHING`],
  ["blocks (cleanup self)", `DELETE FROM "Block" WHERE "blockerId" = "blockedId"`],

  ["posts", `INSERT INTO "Post" (id, "authorId", "projectId", "organizationId", type, body, status, "likeCount", "commentCount", "shareCount", "createdAt", "updatedAt")
    SELECT 'po' || i, 'u' || ${skew(USERS)},
           CASE WHEN i % 100 < 5 THEN 'p' || ${skew(PROJECTS, 2)} END,
           CASE WHEN i % 100 BETWEEN 5 AND 7 THEN 'o' || ${skew(ORGS, 2)} END,
           ${pickEnum(["TEXT", "TEXT", "TEXT", "PROJECT_UPDATE", "DISCUSSION", "HELP_REQUEST", "ACHIEVEMENT"], "PostType")},
           ${text(20, "i")} || ' #' || (${wordsSql})[1 + floor(random() * ${WORDS.length})::int],
           (CASE WHEN i % 200 = 0 THEN 'DELETED' WHEN i % 333 = 0 THEN 'REMOVED' ELSE 'PUBLISHED' END)::"ContentStatus",
           floor(power(random(), 4) * 200)::int, floor(power(random(), 4) * 40)::int, floor(power(random(), 6) * 20)::int,
           ts, ts
    FROM (SELECT i, now() - (power(random(), 2) * interval '365 days') AS ts FROM generate_series(1, ${POSTS}) i) s`],

  ["post tags", `INSERT INTO "PostTag" ("postId", "tagId")
    SELECT 'po' || i, 't' || ${skew(Math.min(TAGS, WORDS.length), 2)} FROM generate_series(1, ${POSTS}) i WHERE i % 5 <> 0 ON CONFLICT DO NOTHING`],

  ["comments", `INSERT INTO "Comment" (id, "postId", "authorId", body, "createdAt", "updatedAt")
    SELECT 'c' || i, 'po' || ${skew(POSTS, 1.5)}, 'u' || ${uniform(USERS)}, ${text(12, "i")}, now() - (random() * interval '300 days'), now()
    FROM generate_series(1, ${n(500_000)}) i`],

  ["reactions", `INSERT INTO "Reaction" ("postId", "userId", "createdAt")
    SELECT 'po' || ${skew(POSTS, 1.5)}, 'u' || ${uniform(USERS)}, now() - (random() * interval '300 days')
    FROM generate_series(1, ${n(2_000_000)}) ON CONFLICT DO NOTHING`],

  ["saved posts", `INSERT INTO "SavedPost" ("userId", "postId")
    SELECT 'u' || ${skew(USERS)}, 'po' || ${uniform(POSTS)} FROM generate_series(1, ${n(200_000)}) ON CONFLICT DO NOTHING`],

  ["conversations", `INSERT INTO "Conversation" (id, "pairKey", "createdAt", "lastMessageAt")
    SELECT 'cv' || row_number() OVER (), least(a, b) || ':' || greatest(a, b), now() - interval '300 days', now() - (random() * interval '300 days')
    FROM (SELECT DISTINCT least(a, b) AS a, greatest(a, b) AS b FROM
            (SELECT 'u' || ${skew(USERS, 2)} AS a, 'u' || ${uniform(USERS)} AS b FROM generate_series(1, ${CONVS})) y WHERE a <> b) x`],

  ["participants", `INSERT INTO "ConversationParticipant" ("conversationId", "userId", "lastReadAt")
    SELECT id, split_part("pairKey", ':', 1), now() - (random() * interval '30 days') FROM "Conversation"
    UNION ALL
    SELECT id, split_part("pairKey", ':', 2), now() - (random() * interval '30 days') FROM "Conversation"`],

  ["messages", `INSERT INTO "Message" (id, "conversationId", "senderId", body, "createdAt")
    SELECT 'm' || i, c.id, CASE WHEN random() < 0.5 THEN split_part(c."pairKey", ':', 1) ELSE split_part(c."pairKey", ':', 2) END,
           ${text(15, "i")}, now() - (random() * interval '300 days')
    FROM (SELECT i, 'cv' || (1 + floor((SELECT count(*) FROM "Conversation") * power(random(), 2)))::int AS cid
          FROM generate_series(1, ${n(1_000_000)}) i) s
    JOIN "Conversation" c ON c.id = s.cid`],

  ["notifications", `INSERT INTO "Notification" (id, "userId", type, "actorId", href, text, "readAt", "createdAt")
    SELECT 'n' || i, 'u' || ${skew(USERS, 2)},
           ${pickEnum(["POST_LIKE", "POST_COMMENT", "NEW_FOLLOWER", "CONNECTION_REQUEST", "MENTION", "OPPORTUNITY_MATCH", "ENTITY_UPDATE"], "NotificationType")},
           'u' || ${uniform(USERS)}, '/posts/po' || ${uniform(POSTS)}, ${text(10, "i")},
           CASE WHEN random() < 0.8 THEN now() END, now() - (random() * interval '300 days')
    FROM generate_series(1, ${n(2_000_000)}) i`],

  ["perf sessions", `INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt")
    SELECT 's-' || u, u, encode(sha256(convert_to('perf-token-' || u, 'UTF8')), 'hex'), now() + interval '30 days'
    FROM unnest(ARRAY['u1', 'u${Math.ceil(USERS / 100)}', 'u${Math.ceil(USERS / 2)}']) u`],

  ["analyze", `ANALYZE`],
];

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SET synchronous_commit = off");
  await client.query("SELECT setseed(0.42)");
  const started = Date.now();
  for (const [name, sql] of steps) {
    const t = Date.now();
    const res = await client.query(sql);
    console.log(`${name.padEnd(22)} ${String(res.rowCount ?? "").padStart(9)} rows  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  const { rows } = await client.query(`
    SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables
    WHERE n_live_tup > 0 ORDER BY n_live_tup DESC`);
  console.table(rows);
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s (scale ${SCALE})`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
