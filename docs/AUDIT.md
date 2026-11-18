# M0 audit: baseline and prioritized gap list

Date: 2026-11-11. Scope: the whole repository as delivered in phases 1–5 (docs/PHASES.md). No product code was changed in M0. The only changes are new docs, perf scripts and a test-infrastructure tweak (see §8).

Companion documents:
- [docs/security/threat-model.md](security/threat-model.md): STRIDE for auth, messaging, uploads and moderation.
- [docs/security/authz-matrix.md](security/authz-matrix.md): role × action × entity matrix (214 rows, 1,219 cells), cross-surface rules for blocks/private projects/members-only profiles, discrepancies F-01…F-24, and test coverage per row.
- [docs/audit/a11y-baseline.md](audit/a11y-baseline.md): axe on all 54 routes, signed in and out, light/dark, 360 px; keyboard walkthroughs; ARIA snapshots.
- Raw evidence: `docs/audit/evidence/` (logs, JSON results, EXPLAIN plans, coverage summary).

**Priority scale.** **P0**: exploitable or broken now with high impact; fix before real users. **P1**: required to meet the targets in the mission brief or a significant user-facing defect. **P2**: important, schedule within the milestone that owns it. **P3**: polish/hardening.
**Effort.** **S** ≤ 1 day · **M** 2–4 days · **L** 1–2 weeks (one engineer, including tests and docs).

---

## 1. Baseline (green)

Environment: MacBook (6 CPU, 8 GB), Node 26.13, npm 11.20. Postgres 16.15 runs in Docker in a 4 GB VM with stock settings (`shared_buffers=128MB`, `work_mem=4MB`, `max_connections=100`) on port 55432, because 5432 belongs to another project.

| Step | Command | Result | Wall time |
| --- | --- | --- | --- |
| Install | `npm ci` | OK. **Fails without a `.env`** (postinstall `prisma generate` needs `DATABASE_URL`, see QA-05) | 17 s (warm cache) |
| Typecheck | `npm run typecheck` | 0 errors | 10 s |
| Lint | `npm run lint` | 0 problems | 5 s |
| Unit + integration | `npm test` (Vitest, real Postgres) | **39/39 passed**, 5 files | 15 s |
| Build | `npm run build` | OK, 50 pages, PPR on member pages | 14 s |
| E2E | `npx playwright test` (prod build, port 3100) | **13/13 passed** (A–G, security, axe ×5, mobile) | 51 s |
| Coverage (new, not in CI) | `vitest --coverage` on `src/server/**`, `src/lib/**` | **lines 69.3%**, statements 63.2%, branches 51.0%, functions 61.7% | 9 s |

Logs: `docs/audit/evidence/baseline-*.log`. Coverage: `docs/audit/evidence/coverage/coverage-summary.json`. Local CI-equivalent time ≈ 2 min plus install and browser download, well under the 10-minute target. The sequential E2E (`workers: 1`) will become the bottleneck as tests grow.

## 2. The 8 known issues, confirmed

| # | Issue | Confirmed? | Evidence | ID |
| --- | --- | --- | --- | --- |
| 1 | Login rate limit bypass via `X-Forwarded-For` | **Yes.** `getRequestContext` (`src/server/auth/viewer.ts:48-55`) takes the first XFF hop from the client. `authenticate` keys `login` by `email|ip` (`src/server/auth/service.ts:53`). Signup and password reset use the same spoofable key. Failed logins for unknown emails are not audited. Every spoofed IP also creates a `RateLimit` row that is never deleted. | code | SEC-01 |
| 2 | Live tokens in `EmailOutbox` | **Yes.** `sendEmail` stores `text` with the full verify/reset link before sending (`src/server/mail/mailer.ts:23`). Rows are never deleted. `/dev/mailbox` renders them **without authentication** in any non-production deployment. | code | SEC-02, SEC-14 |
| 3 | Media readable by anyone with the key | **Yes.** `/api/media/[...key]` has no authorization and sends `Cache-Control: public, max-age=31536000, immutable`, so private-project gallery images, removed posts' images and deleted users' avatars stay served (and cached by intermediaries) forever. Storage is local disk only. | code | SEC-03 |
| 4 | Fan-out inside the request | **Yes, measured.** `createPost` as an org with 6,508 followers: **p50 610 ms, p95 622 ms** vs 2.9 ms for a personal post. That's 500 sequential `notify()` calls × 4 queries each. Followers beyond 500 are **silently skipped**. Opportunity publish runs matching inline: p50 41 ms on this data (capped at 200 candidates / 50 notifications), plus the announcement post. | `evidence/perf-services.log` | REL-01 |
| 5 | CSP `'unsafe-inline'` scripts | **Yes.** `next.config.ts:11`. Styles also use `'unsafe-inline'`. | code | SEC-05 |
| 6 | No housekeeping | **Yes.** No code deletes expired `Session`, used/expired `AuthToken`, `RateLimit`, `EmailOutbox`, old `Notification` or `AuditLog` rows, or orphan `MediaAsset` files. | grep | DATA-01 |
| 7 | Unbounded work per request | **Yes, measured; worse than described for post search and tag pages.** See §4. | EXPLAIN plans | PERF-01…07 |
| 8 | Missing/private entities return 200 | **Yes.** `/u/<missing>`, private `/p/<slug>`, and missing `/o`, `/posts`, `/opportunities`, `/tags` all return **200** with the not-found UI and `noindex`. Unknown routes return 404. Member pages return 307 to `/login`. | `audit/a11y/results/status-codes.json`, `evidence/perf-http-c1.log` | REL-05 |

## 3. Security, privacy and authorization findings

Ordered by priority. "F-nn" refers to [authz-matrix.md §21](security/authz-matrix.md). Every finding was traced in code. F-01, F-03, F-04, F-13 and F-17 were re-verified by hand.

| ID | P | Finding | Location | Effort |
| --- | --- | --- | --- | --- |
| SEC-01 | **P0** | Login/signup/reset limits bypassable via spoofed XFF (known #1). No per-account limit, no backoff, no user alert, no audit of unknown-email failures. Unlimited scrypt attempts also make this a CPU DoS vector. | `auth/viewer.ts:48`, `auth/service.ts:21,53,188` | M |
| SEC-02 | **P0** | Reset and verification links stored in plaintext forever (known #2). | `mail/mailer.ts:23` | S |
| SEC-03 | **P0** | Media served without authorization and cached publicly for a year (known #3). Private-project images, removed content and deleted users' photos stay reachable. | `app/api/media/[...key]/route.ts` | L |
| SEC-14 | **P1** | `/dev/mailbox` is unauthenticated whenever `NODE_ENV !== "production"` (staging, previews), which exposes everyone's reset links (F-04). | `(app)/dev/mailbox/page.tsx:13` | S |
| SEC-04 | **P1** | Members-only profiles leak to signed-out visitors through cards: post authors, comments, likers, team lists, connection/follower lists, personal opportunities (F-03). This breaks the privacy promise. | `posts.ts:33,251,390`, `projects.ts:107`, `organizations.ts:99`, `social/graph.ts:127-139,255-276`, `selects.ts:61` | M |
| SEC-05 | **P1** | CSP allows inline scripts (known #5). | `next.config.ts` | M |
| SEC-09 | **P1** | No 2FA, and no step-up for staff (moderation, suspensions, audit log). | — | L |
| SEC-11 | **P1** | Email change takes effect immediately: no confirmation to the new address, no notice to the old one, other sessions kept. Stolen session + password = silent takeover. | `auth/service.ts` `changeEmail` | S |
| PRIV-01 | **P1** | The data export doesn't match the privacy page. Missing: security logs (sign-ins/IPs from `AuditLog`), reactions, saved posts, notifications, followers, blocks, reports filed, invitations, created projects/orgs/opportunities, application events, uploaded media. | `auth/service.ts` `exportAccountData` | S |
| PRIV-02 | **P1** | Erasure leaves personal data behind: media files and `MediaAsset` rows, `EmailOutbox` rows (address + content), `AuditLog` IPs, `Report.details`. @mention rows keep the handle, so a new owner of the username inherits them (F-12). Org/project posts by the user are hard-deleted. Deleting reactions and comments doesn't decrement post counters (DATA-02). | `auth/service.ts:268-336` | M |
| PRIV-03 | **P1** | No retention policy, no record of which terms version a user accepted, no deletion grace period, no record of processing activities. | — | M |
| SEC-06 | P2 | An org project is controlled by its direct OWNER (whoever created it), not by the org. An org EDITOR who creates one keeps control after leaving the org (F-01). | `projects.ts:19,38,48,72`, `authz.ts:65,100` | M |
| SEC-07 | P2 | Accepting an invitation doesn't re-check that the inviter can still grant the role (F-02). | `invitations.ts:68-92` | S |
| SEC-08 | P2 | Block and visibility gaps on secondary surfaces (F-05, F-06, F-08, F-09, F-10, F-11, F-20): sharing a share, attaching any open opportunity to a post, mention autocomplete (also ignores `searchable`), suggestions, likers/member lists, hidden location used in matching, follower lists ignore the audience setting, posting as a PRIVATE project notifies followers with an excerpt. | see matrix §20 | M |
| SEC-18 | P2 | Opportunity, project and org state drift. Making a project private leaves its opportunities OPEN. Publishing through edit skips project-status and email-verification checks. Application decisions ignore REMOVED/archived owners. Archived orgs can still own new projects (F-07, F-15, F-22, F-24). | `opportunities.ts:125,154,191`, `applications.ts:36,91`, `authz.ts:88` | M |
| SEC-16 | P2 | Open redirect: `markNotificationReadAction` accepts `/\evil.example` (F-17, verified). `safeNext` doesn't reject control characters like `/\t/evil.example` (unverified whether Next encodes them). | `actions/social.ts:194`, `actions/auth.ts:12` | S |
| SEC-17 | P2 | `/api/uploads` buffers the whole multipart body before the size check (no `Content-Length` guard). Unverified accounts can upload, and there's no per-user quota. | `api/uploads/route.ts`, `uploads.ts` | S |
| SEC-10 | P2 | Fixed 30-day sessions: no sliding expiry, no rotation on privilege change, the old session isn't revoked on re-login, no re-auth for sensitive actions. | `auth/service.ts`, `auth/viewer.ts` | M |
| SEC-12 | P2 | No bot protection and no breached-password check on signup/login. | — | M |
| MOD-01 | P2 | Moderation is looser on the server than in the UI (F-16): the action is applied by target type ("suspend" on a post report only removes the post), "restore" reactivates archived projects and self-deactivated users, and a MODERATOR can lift an ADMIN's suspension. Authors aren't notified, there's no appeal, and moderators can resolve reports about themselves. | `moderation.ts:96-146` | M |
| MOD-02 | P2 | Evidence handling: removing a reported message hard-deletes it, and `AuditLog` is mutable by the app's DB role with no retention or integrity guarantees. | `moderation.ts:124` | M |
| SEC-13 | P3 | Signup reveals whether an email is registered. | `auth/service.ts:24` | S |
| SEC-15 | P3 | `assertSameOrigin` trusts `X-Forwarded-Host`. Compare with `APP_URL` instead. | `server/http.ts:28` | S |
| PRIV-04 | P3 | Message excerpts go into notification text and email digests. Fine if disclosed; the privacy page doesn't say so. | `messaging.ts:94` | S |
| PRIV-05 | P3 | Moderators see every user's IP in the audit log view. | `moderation.ts:144` | S |
| SEC-19 | P3 | Reporting an id confirms that it exists, including private projects (F-23). Low value with cuid ids. | `moderation.ts:9` | S |

**Checked and correct** (from the matrix): no role escalation through invitations or role changes; delegated org roles never exceed project ADMIN; every id-based mutation is scoped or re-authorized (no IDOR found); application notes are visible only to managers; applying for an org requires EDITOR+; moderators can't suspend admins or other moderators; suspended users lose their sessions and their content is hidden; uploads are decoded, re-encoded and stripped of metadata, and keys can't traverse paths; password hashing and login timing equalization are sound.

## 4. Performance on the large dataset

Dataset (`npm run perf:seed`, `scripts/perf/seed-large.ts`, loads in 7 min): 50k users, 5k orgs, 20k projects, 50k opportunities, **1.0M posts**, 1.29M connections, 1.41M follows, 2.0M reactions, 500k comments, 1.0M messages, 2.0M notifications. Distributions follow a power law: viewer `u1` has 13,189 connections, the p99 viewer 163, the median 30. The largest org has 6,508 followers. Counters are synthetic.

Two harnesses:
- `npm run perf:services`: calls the service functions directly. 20 sequential runs after a warm-up.
- `npm run perf:http`: requests the production server and measures TTFB and time to the end of the streamed body, signed in. Runs at concurrency 1 and 8.

These are laptop numbers with the app and Postgres on one machine and an untuned DB. Read them relative to each other; the k6 runs in M2 will give the absolute numbers.

### 4.1 HTTP (time to complete streamed response)

Target: p95 < 300 ms server time at a documented load.

| Route | c=1 p50 / p95 | c=8 p50 / p95 | vs target |
| --- | --- | --- | --- |
| `/feed` (for you) | 142 / 167 ms | 527 / 768 ms | ✗ at c=8 |
| `/feed?mode=latest` | 137 / 144 ms | 504 / 757 ms | ✗ at c=8 |
| `/discover?q=react` | 560 / 649 ms | **3,454 / 5,327 ms** | ✗ |
| `/discover?type=people&q=react` | 295 / 334 ms | 1,024 / 1,472 ms | ✗ |
| `/opportunities` | 133 / 180 ms | 377 / 509 ms | ✗ at c=8 |
| `/opportunities?sort=match` | 134 / 192 ms | 607 / 763 ms | ✗ at c=8 |
| `/u/user1` (heavy profile) | 81 / 153 ms | 415 / 453 ms | ✗ at c=8 |
| `/u/user1/connections` | 102 / 177 ms | 559 / 914 ms | ✗ at c=8 |
| `/p/project-1` | 31 / 47 ms | 134 / 167 ms | ✓ |
| `/o/org-1` | 91 / 107 ms | 323 / 464 ms | ✗ at c=8 |
| `/opportunities/op1` | 14 / 24 ms | 59 / 70 ms | ✓ |
| `/tags/react` | **993 / 1,298 ms** | **4,266 / 6,350 ms** | ✗ |
| `/notifications`, `/messages` | ≤ 12 ms | ≤ 65 ms | ✓ |
| message poll API | 3 / 4 ms | 10 / 30 ms | ✓ |

TTFB is 1–9 ms everywhere: the shell streams immediately and the time goes into Suspense boundaries waiting on the DB. Source: `evidence/perf-http-c1.log`, `perf-http-c8.log`.

### 4.2 Service level (sequential, p50 / p95)

| Path | Heavy (u1) | Median | Note |
| --- | --- | --- | --- |
| feed for-you p1 | 27 / 41 ms | 11 / 23 ms | fast but **wrong at scale** (PERF-03) |
| feed latest p1 | 46 / 86 ms | 5 / 9 ms | 13k-id `IN` list for u1 |
| feed latest page 20 | — | 83 / 132 ms | OFFSET pagination |
| search posts `q=react` | — | **2,396 / 2,821 ms** | seq scan of 1M posts for the COUNT |
| search posts `tag=react` | — | **1,011 / 1,636 ms** | sorts 70k matches for 20 rows, plus COUNT |
| search people `q='react design lisbon'` | — | 435 / 461 ms | 6 Profile joins, COUNT |
| search people no-hit `q=zzqx` | — | 527 / 548 ms | worst case: nothing to stop early |
| search projects `q=climate` | — | 334 / 383 ms | |
| search opportunities `q=design` | — | 167 / 183 ms | |
| quick search | — | 604 / 832 ms | 4 searches + 4 COUNTs |
| listConnections p1 | 64 / 79 ms | 1.3 / 1.7 ms | loads all 13k ids |
| recommendOpportunities | 109 / 151 ms | 117 / 139 ms | p99 viewer 183 / 296 ms |
| suggestPeople | 123 / 183 ms | 21 / 24 ms | |
| createPost as org (6.5k followers) | — | 611 / 622 ms | known #4 |

Source: `evidence/perf-services.log`, `perf-services.json`. Top statements by mean time: `evidence/pg-stat-statements-top.txt`.

### 4.3 Findings and EXPLAIN evidence

Plans are in `docs/audit/evidence/explain-before/` (`INDEX.md` lists them). They were captured by `scripts/perf/explain-slow.ts`, which records the exact Prisma SQL with its parameters and replays it with `EXPLAIN (ANALYZE, BUFFERS)`. Rerun it after each fix to produce the "after" plans.

| ID | P | Finding | Evidence | Fix direction | Effort |
| --- | --- | --- | --- | --- | --- |
| PERF-01 | **P1** | Post search and tag pages don't use the trigram index. The `OR (body ILIKE … OR EXISTS tag …)` predicate forces a **Seq Scan on Post** (1M rows, 209k matches) for the COUNT: **2.57 s**. Tag filter: 70k `PostTag` rows joined, sorted and counted. The planner estimates 6,202 rows vs 70,618 actual (stale/low stats on skewed tags). | `explain-before/01-search-posts-q.txt`, `02-search-posts-tag.txt` | Search v2 (weighted `tsvector` + GIN), tag pages as an index-ordered `(tagId, createdAt)` keyset scan on a denormalized `PostTag.createdAt`, drop exact counts | L |
| PERF-02 | **P1** | Every search page runs an exact `COUNT(*)` on the same join tree as the page query. The COUNT is the slowest statement on 6 of the top 10 rows. | `pg-stat-statements-top.txt` | "20+ results" style capped counts or `has_more` via `take+1`, cursor pagination | M |
| PERF-03 | **P1** | **The for-you feed is incorrect at scale, not just slow.** Its candidate set is the 400 *globally* most recent posts in 21 days. At 1M posts/year that's roughly the last 3 hours, so network posts older than that never show up in "For you". | `feed.ts:119-126`, `config/feed.ts` | Fan-out-on-write inbox (capped) + global trending pool; rank per viewer | L |
| PERF-04 | **P1** | The latest feed builds `authorId IN (<all connections + follows>)`: 13k bind parameters for u1, and Postgres's 65,535-parameter ceiling is reachable. Loading the ids alone costs 103 ms cold. OFFSET pagination costs 83 ms at page 20. | `explain-before/09-feed-latest-heavy.txt` | Join against `Connection`/`Follow` in SQL or a precomputed inbox, keyset cursor | M |
| PERF-05 | P2 | `listConnections` loads every connection id, then pages users with `IN` + OFFSET: 64 ms for u1, 914 ms p95 under load. | `explain-before/13-list-connections-heavy.txt` | Keyset pagination joined on `Connection` | S |
| PERF-06 | P2 | "Best match" sort scores 300 opportunities in memory per request. Total and page count are capped at 300, so pagination silently ends there. | `search.ts:228-262` | Precomputed and cached match scores, invalidated on profile/opportunity change | M |
| PERF-07 | P2 | `refreshTagUsage` recounts five tables per write with correlated subqueries: 38 ms for 3 hot tags. It runs inside the post transaction and takes a row lock on hot `Tag` rows, which serializes concurrent posts that use the same hashtag. | `explain-before/23-tag-usage-recount-hot-tag.txt` | Increment/decrement counters, or recompute asynchronously in a job | S |
| PERF-08 | P2 | Message polling every 4 s per open conversation. Cheap per call (3 ms), but it scales linearly with open tabs. The `createdAt > after` cursor can skip messages that share a millisecond. | `messaging.ts:166` | SSE (M4), `(createdAt, id)` cursor | M |
| PERF-09 | P2 | The email digest scans all 2M notifications: no index on `emailStatus`, **787 ms**, parallel seq scan. | `explain-before/22-digest-queued-scan.txt` | Partial index `WHERE emailStatus='QUEUED'`, move to job queue | S |
| PERF-10 | P3 | The moderation queue runs one preview query per report (N+1, up to 100). | `moderation.ts:86` | Batch by target type | S |
| PERF-11 | P2 | People search joins `Profile` 6 times (one per relation filter Prisma emits) and runs a 30k-row hash join pipeline for 13 results. `User.username` has no trigram index. | `explain-before/05-search-people-q.txt` | Search v2 on a single searchable document per entity | (with PERF-01) |
| PERF-12 | P3 | Page-number pagination up to page 500 on every listing. Deep offsets cost linearly. | `search.ts:49` | Cursors | (with PERF-02) |

## 5. Reliability, operations and data

| ID | P | Finding | Effort |
| --- | --- | --- | --- |
| REL-01 | **P1** | Side effects (follower and matching fan-out, mention notifications, emails) run inside the user's request. There's no queue, retry or outbox, and failures are best-effort or lost (known #4). | L (M2 queue) |
| REL-02 | **P1** | Emails are sent synchronously over SMTP inside signup/reset/password-change requests. The digest job has no locking, so two concurrent runs double-send. Notifications are marked `SENT` even when the SMTP send failed (the mailer swallows the error), so digests are silently lost. | M |
| DATA-01 | **P1** | No retention or cleanup for `Session`, `AuthToken`, `RateLimit`, `EmailOutbox`, `Notification`, `AuditLog` or orphan uploads (known #6). | M |
| REL-03 | **P1** | DB connection hygiene: default `pg` pool (10) per process, no `statement_timeout`/`idle_in_transaction_session_timeout`, a single DB role for app, migrations and tests, no graceful shutdown. | S |
| OPS-01 | **P1** | No tracing, metrics or request ids. Logs are structured JSON but uncorrelated. | L (M3) |
| OPS-08 | **P1** | No backups/PITR, no staging, no IaC, single-instance local-disk uploads. | L (M3, needs cloud decision) |
| REL-05 | P2 | Soft 404s with status 200 (known #8). | M |
| REL-06 | P2 | Opening a conversation whose other participant deleted their account returns a 500: the participant row is removed, then `other!.user` crashes (F-13, verified). | S |
| DATA-02 | P2 | Counter drift: account deletion removes reactions/comments without decrementing `likeCount`/`commentCount`. No reconciliation job. | S |
| DATA-03 | P2 | `RateLimit` grows unbounded, made worse by SEC-01 (one row per spoofed IP). | S |
| DATA-04 | P2 | Uploads never attached to content are kept forever. No per-user storage quota. | S |
| OPS-02 | P2 | `/api/health` mixes liveness and readiness (DB check). There's no separate liveness endpoint. | S |
| OPS-03 | P2 | Audit log: no request id or user agent, failed logins for unknown accounts aren't recorded, rows are mutable. | S |
| OPS-04 | P2 | Errors are logged with full message and stack, and Prisma errors can include values (PII). No scrubbing. | S |
| OPS-05 | P2 | CI has no dependency, secret or image scanning and no SBOM. npm 11 now blocks dependency install scripts by default (`prisma`, `@prisma/engines`, `esbuild` were skipped locally and things still work). Make an explicit `allowScripts` decision. | S |
| OPS-07 | P2 | E2E runs `next start` against an `output: "standalone"` build, and Next warns that this is unsupported. The tests don't exercise the artifact that ships in Docker (`server.js`). | S |
| OPS-06 | P3 | `docker-compose.yml` ships `CRON_SECRET: change-me` and a placeholder Server Actions key. Fine for local use, but fail fast if they reach production. | S |
| OPS-09 | **P0 (process)** | **The working directory is not a git repository.** There's no history, branches, PRs or CI runs, and the commit workflow in the working rules can't be followed. | S (needs owner) |

## 6. Accessibility (summary of [audit/a11y-baseline.md](audit/a11y-baseline.md))

180 axe scans: 70 route × auth combinations, light and dark at 1280 px, plus 20 main pages at 360 px. Result: **0 critical, 134 serious rule-instances (604 nodes)**, 0 moderate/minor. The current E2E axe check passes only because it covers 5 signed-out pages in light mode. Target: zero serious/critical on every route.

| ID | P | Finding | Effort |
| --- | --- | --- | --- |
| A11Y-01 | **P0** | Notification items are announced only as "Open" / "Open (unread)". Verified at `notifications/notification-link.tsx:13`. | S |
| A11Y-02 | **P0** | Focus drops to `<body>` after an invalid submit (all `ActionForm`s except login) and after in-place actions (like, post, comment, connect, apply). | M |
| A11Y-03 | **P0** | At 360 px the fixed bottom nav hides focused elements (2.4.11). | S |
| A11Y-04 | P1 | `target-size`: 392 nodes (filter checkboxes 14 px, entity links 20 px). | S |
| A11Y-05 | P1 | Links distinguished only by colour (hashtags/mentions/inline links): 82 nodes. | S |
| A11Y-06 | P1 | Dark-mode contrast: unread badge white on `#f08a5d` (2.47:1, verified in `globals.css:48`), own-message timestamps. 58 nodes. | S |
| A11Y-07 | P1 | `role="menu"` widgets without menu keyboarding, and focus not returned on close (user menu, post options, share, report dialog). | M |
| A11Y-08 | P1 | Mobile DOM order puts the bottom nav before `<main>`. The composer's @mention suggestions aren't keyboard operable (code read). | M |
| A11Y-09 | P1 | `label-content-name-mismatch`: 68 nodes. | S |
| A11Y-10 | P2 | Faint text-field focus ring (1.38:1), generic page titles ("Opportunity", "Post"), missing h1 on two routes, nested `<main>` on not-found, the whole message history is a live region. | M |
| A11Y-11 | P3 | Reduced motion covers only the skeleton shimmer. Route-change focus management is missing. | S |
| A11Y-12 | P1 | **Manual VoiceOver/NVDA passes have not been done.** The sweep used ARIA snapshots as a proxy. Safari/Firefox, forced colours and 200–400% zoom are also untested. | M (human) |

## 7. Quality, engineering and product

| ID | P | Finding | Effort |
| --- | --- | --- | --- |
| QA-01 | P1 | Line coverage is 69.3% (target ≥ 85%). Branches are at 51%. Coverage isn't measured in CI and `@vitest/coverage-v8` isn't a dependency. | M |
| QA-02 | P1 | Authorization tests: 129 of 214 matrix rows (733 cells) have no test, and none of the discrepancy cells is tested (target 100%). | L |
| QA-03 | P2 | `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` are off. `as unknown as` casts in `feed.ts:126,130`. Non-null assertions hide F-13-type crashes. | M |
| QA-04 | P2 | Architecture rules aren't enforced (pages read `db` directly in places, e.g. `dev/mailbox`, `api/mentions`). No dependency-cruiser. | S |
| QA-05 | P3 | `npm ci` fails without `.env`. `.env.test` hardcodes `localhost:5432` (M0 added a `TEST_DATABASE_URL` override; see §8). | S |
| QA-06 | P2 | a11y and perf harnesses live outside CI (`docs/audit/a11y`, `scripts/perf`). They'll move into nightly jobs in M2/M5. | S |
| I18N-01 | P2 | All UI copy is hardcoded English. No message catalogs, locale detection, or localized dates/numbers. | L (M4) |
| PROD-01 | P2 | Funnel steps aren't measurable: no analytics events for signup → profile → project/opportunity → application → accepted. | M (M3) |
| TS-01 | P2 | No new-account restrictions, link/mention limits, duplicate detection or spam scoring. | M (M7) |

## 8. What M0 changed

- New docs: `docs/AUDIT.md`, `docs/security/threat-model.md`, `docs/security/authz-matrix.md`, `docs/audit/a11y-baseline.md`, `docs/audit/a11y/*` (standalone Playwright a11y harness, not part of `npm run test:e2e`), `docs/audit/evidence/*`.
- New scripts: `scripts/perf/seed-large.ts`, `measure-services.ts`, `measure-http.ts`, `explain-slow.ts`. New npm scripts `perf:seed`, `perf:services`, `perf:http`.
- Test infrastructure: `tests/setup.ts` and `tests/global-setup.ts` honour an optional `TEST_DATABASE_URL`. Without it, behaviour is unchanged.
- Product code: **none**.

## 9. Recommended order (maps onto M1–M8)

1. **Before anything ships to real users (M1, week 1):** SEC-01, SEC-02, SEC-14, SEC-11, SEC-04, OPS-09 (repository), REL-06, SEC-16. All are S/M and test-first.
2. **M1 remainder:** SEC-03 (needs the storage interface), SEC-05, SEC-09, SEC-10, PRIV-01…03, DATA-01 (a minimal scheduled purge until the queue lands), SEC-06/07/08/18, MOD-01, the table-driven authz suite (QA-02), CI scanning (OPS-05).
3. **M2:** job queue + outbox (REL-01, REL-02, PERF-07, PERF-09), Search v2 (PERF-01, PERF-02, PERF-11, PERF-12), feed inbox (PERF-03, PERF-04), cursors (PERF-05), match-score cache (PERF-06), REL-03, REL-05, k6 nightly.
4. **M5 a11y, pulled forward where cheap:** A11Y-01, -03, -05, -06 are S-sized and can go in during M1 alongside the security work.

Rough total for P0+P1: **≈ 9–11 engineer-weeks**, dominated by SEC-03, SEC-09, REL-01, PERF-01 and PERF-03.
