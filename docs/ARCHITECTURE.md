# Architecture

This document records the main technical decisions and how the modules fit together.

## 1. Shape of the system

A **modular monolith**: one Next.js application, one PostgreSQL database, no microservices. Modules are folders with clear boundaries, not deployment units.

```
Browser ──► Next.js (App Router)
             ├─ pages (React Server Components, streamed behind Suspense)
             ├─ server actions  ┐  thin adapters: session → zod validation →
             ├─ route handlers  ┘  service call → refresh()/redirect
             └─ src/server/*  domain services (authorization, rules, side effects)
                                   └─ Prisma 7 + pg driver ──► PostgreSQL 16
```

**Rules of the codebase**

- Pages, actions and route handlers never touch Prisma directly for writes; they call services in `src/server`.
- Services receive the acting user explicitly (`Actor`) instead of reading cookies, so they are testable without HTTP and authorization is always explicit.
- Every service mutation checks permissions itself (`src/server/authz.ts`), regardless of what the UI shows.
- Inputs are validated with zod schemas in `src/lib/validation.ts`, shared by forms and services.
- Domain errors (`ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, …) carry an HTTP status and optional field errors. `runAction` turns them into form state; `handleApi` into a JSON envelope `{ error: { code, message, fields } }`; `orNotFound` into the 404 page.
- Public reads use explicit `select` shapes (`src/server/selects.ts`) so private columns (emails, password hashes, tokens) never leave the server.

## 2. Next.js 16 specifics

- **Cache Components** are on (the default for new apps, and the direction of the framework). Request data (cookies, search params) must be read inside a `<Suspense>` boundary: each route group has a `loading.tsx`, the top bar streams in its own boundary, and `getViewer()` calls `connection()` so everything downstream of the session renders per request.
- Mutations use **Server Actions** (built-in Origin/Host CSRF check, encrypted action IDs). Actions call `refresh()` so the response carries the re-rendered page.
- Forms submit through a transition (`ActionForm`) so React does not clear what the user typed when validation fails; they still work without JavaScript through the native `action` attribute.
- Toasts are raised when an action settles, so feedback survives even when the button that triggered it disappears from the refreshed page.
- `proxy.ts` (formerly middleware) does an optimistic redirect to `/login` for member-only paths when no session cookie is present; the real session check happens in every page/action.
- Streaming starts with a `200`, so "not found" for private resources renders the 404 UI with `noindex` rather than a 404 status (documented framework behavior). No private data is sent.

## 3. Data model

Prisma schema: `prisma/schema.prisma`. Constraints Prisma can't express live in the first migration (`prisma/migrations/*_init/migration.sql`).

| Area | Tables | Notes |
| --- | --- | --- |
| Identity | `User`, `Session`, `AuthToken`, `ExternalAccount`, `Handle` | Sessions are random 256-bit tokens stored as SHA-256. `Handle` is one namespace for usernames and org/project slugs, so `@anything` resolves to exactly one entity (CHECK). `ExternalAccount` is ready for OAuth providers. |
| Profiles | `Profile`, `Experience`, `Education`, `UserTag` | Availability, preferences and privacy settings live on `Profile`. Skills and interests are `UserTag` rows (kind SKILL/INTEREST). |
| Tags | `Tag`, `UserTag`, `ProjectTag`, `OrganizationTag`, `OpportunityTag`, `PostTag` | Typed join tables keep real foreign keys and cascades. Tags are normalized to slugs with an alias map (`reactjs` → `react`, `ai` → `artificial-intelligence`) shared by client and server. |
| Organizations | `Organization`, `OrganizationMember` | Roles OWNER / ADMIN / EDITOR / MEMBER. |
| Projects | `Project`, `ProjectMember`, `ProjectImage` | Optional owning organization; members can be linked to the opportunity they filled. |
| Relationships between entities | `Partnership`, `Invitation` | One partnership row per unordered pair of entities (`pairKey` unique) covering project↔project, org↔org and project↔org; CHECKs ensure one entity per side and no self-partnership. At most one pending invitation per entity and invitee (partial unique index). |
| Opportunities | `Opportunity`, `Application`, `ApplicationEvent` | Owned by a project, an organization or an individual (CHECK). Statuses DRAFT/OPEN/CLOSED/FILLED/ARCHIVED/REMOVED; archiving keeps history. One application per person and opportunity (unique); every status change is an event. |
| Social | `Post`, `PostImage`, `Comment`, `Mention`, `Reaction`, `SavedPost`, `Follow`, `Connection`, `Block` | Posts can be published as a project or organization (CHECK: at most one). Shares are posts with `repostOfId`; a plain share is unique per user (partial unique index). Counters are denormalized and updated in the same transaction (CHECK ≥ 0). Connections are stored once per unordered pair (`userAId < userBId`). Follows target exactly one entity (CHECK) with nullable FKs and unique pairs. |
| Messaging | `Conversation`, `ConversationParticipant`, `Message` | 1:1 conversations keyed by the sorted participant pair (no duplicates). Read state is `lastReadAt` per participant. |
| Notifications | `Notification`, `NotificationPreference` | Snapshot text + link, so notifications stay readable after edits. `emailStatus` queues email delivery. |
| Ops | `Report`, `AuditLog`, `MediaAsset`, `EmailOutbox`, `RateLimit` | |

**Deletion policy.** Content uses soft states where history matters (opportunities, applications, moderated posts/comments, archived projects/orgs). Account deletion erases personal data and authored content but keeps an anonymous `User` tombstone so other people's history stays consistent; projects/orgs solely owned by the user are handed to another admin or archived.

**Indexes.** Foreign keys and status/date columns used by listings are indexed; free-text fields used by search have `pg_trgm` GIN indexes so `ILIKE '%term%'` stays index-backed.

## 4. Authorization

`src/server/authz.ts` centralizes roles and permissions.

| Permission | Project | Organization |
| --- | --- | --- |
| view | public, or any member/staff | — |
| edit details, gallery | EDITOR+ | EDITOR+ |
| publish (posts as the entity, opportunities, review applications) | EDITOR+ | EDITOR+ |
| manage members, partnerships | ADMIN+ (only roles below their own) | ADMIN+ |
| change handle, archive, transfer ownership | OWNER | OWNER |

Project roles are **delegated** from the owning organization: org owners/admins act as project admins, org editors as project editors. Opportunities are managed by editors of their owner (or their creator for personal ones). Private projects behave as not-found for non-members, and their opportunities can't be published. Blocks are checked in profile views, follows, connections, messaging, comments, likes, mentions and notifications. Site roles (MODERATOR, ADMIN) unlock the moderation console only.

## 5. Discovery

`src/server/search.ts`: per-entity search functions with combinable filters and page-based pagination.

- Free text is split into terms; every term must match a name/description field **or** a tag (AND of ORs). This makes “AI projects frontend” work without a separate search engine.
- Filters are typed (enums validated against label maps) and composable: e.g. projects by category, stage, technology, “looking for” skills (skills of open opportunities), collaboration type offered, beginner-friendly, open source.
- Privacy is enforced in the queries: non-searchable or members-only profiles, hidden locations, private/archived/removed projects and blocked users are filtered out.
- Opportunities can be sorted by **best match** for the viewer.

Upgrade path: Postgres full-text search (`tsvector` + ranking) or an external engine can replace the term matcher behind the same function signatures.

## 6. Matching and recommendations

`src/lib/matching-engine.ts` (pure, unit-tested) and `src/config/matching.ts` (weights and thresholds).

Score = sum of factor contributions (weights total 100): requested skills 40, topics 10, interests 10, preferred collaboration type 10, availability fit 15, work mode 5, experience level 5, location 5 (only for on-site/hybrid roles). “Not available right now” multiplies the score by 0.2. Every factor emits a human-readable reason (“Has 2 of 3 requested skills: React, TypeScript”) which the UI shows with the score.

Only professional signals the person provided are used; no sensitive or protected attributes exist in the data model.

Uses: opportunities for you (feed sidebar), best-match sorting, suggested people for an opportunity's managers, OPPORTUNITY_MATCH notifications on publish (score ≥ 60, max 50 people), complementary projects for partnerships (projects whose tech or team skills cover your open needs) and people you may know (mutual connections, then shared tags). `src/server/matching.ts` does candidate generation with tag-overlap prefilters, then scores in memory.

## 7. Feed

`src/server/feed.ts` with weights in `src/config/feed.ts`.

- **For you**: candidates from the last 21 days, scored by `RuleBasedRanker`: relationship relevance (own, connections, follows, team projects/orgs, followed projects/orgs, opportunity posts matching your skills, shared tags) plus engagement, multiplied by recency decay (36h half-life). Each item carries the reason shown above it (“From your network”).
- **Latest**: reverse-chronological posts from your network and follows.
- `FeedRanker` is an interface: a learned ranker can be dropped in later without touching pages.

## 8. Messaging and notifications

- Starting a conversation requires: neither side blocked, recipient active, and the recipient's setting allows it (everyone, or connections only, where teammates and people linked through an application also qualify). New conversations are rate-limited per day.
- The conversation view polls `/api/messages/:id?after=` every 4s while visible; reading marks the conversation and its notification read.
- `notify()` checks recipient status, blocks and per-type preferences. One unread NEW_MESSAGE notification per conversation; one like notification per actor and post.
- Email: preferences mark rows `QUEUED`; `deliverQueuedNotificationEmails()` sends one digest per user (cron via `npm run notifications:email` or `POST /api/cron/notification-emails` with `CRON_SECRET`).

## 9. Security

| Concern | Measure |
| --- | --- |
| Passwords | scrypt (N=2¹⁵, r=8, p=3) with per-user salt; parameters stored with the hash; constant-time compare; dummy hash for unknown emails to equalize timing. |
| Sessions | HttpOnly, SameSite=Lax, Secure (production) cookie with a random token; only its SHA-256 is stored; revocable per device; password change/reset revokes other sessions. |
| CSRF | Server Actions check Origin vs Host; cookie-authenticated route handlers (`/api/uploads`) check Origin explicitly; SameSite=Lax cookies. |
| XSS | User content is never rendered as HTML. A tokenizer turns text into escaped text, `http(s)` links, resolved @mentions and #hashtags. CSP restricts scripts/frames/objects; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS. |
| Uploads | Size limit, decode with sharp (non-images rejected regardless of declared type), pixel limit, resize, metadata (EXIF/GPS) stripped, re-encoded as WebP under random keys; references must be the uploader's own assets; served with `nosniff` and a locked-down CSP. |
| Abuse | Postgres-backed fixed-window rate limits for login, signup, password reset, verification, posts, comments, messages, new conversations, connection requests, applications, uploads, reports and invitations. Email verification required before publishing (configurable). |
| Authorization | Service-level checks (section 4); not-found for resources the viewer may not know exist. |
| Moderation | Reports on users, posts, comments, projects, organizations, opportunities and messages; staff console to remove/restore content, suspend accounts and dismiss reports. Removed content is filtered from every public query. |
| Audit | Sign-ins, failed logins, password/email changes, deactivation/deletion, data exports, role changes, invitations, ownership transfers, archiving, partnerships, blocks and every moderation decision are written to `AuditLog` and emitted as JSON log lines. |
| Privacy / GDPR | Profile visibility (public/members), hidden location, connection-list audience, message permission, follow approval, opt-out of search; data export (JSON); deactivation; erasure. |

## 10. Operations

- Configuration is validated at startup by zod (`src/server/env.ts`); see `.env.example`.
- Structured JSON logs (`src/server/logger.ts`).
- `/api/health` checks the database and is never prerendered.
- Docker: standalone output, non-root user, migrations as a separate one-off job (`docker-compose.yml`).
- Uploads are on local disk (`UPLOAD_DIR`); for several instances use a shared volume or replace `src/server/uploads.ts` with an S3-compatible implementation (same interface).

## 11. Known limitations and next steps

- Real-time delivery uses polling; WebSockets/SSE can replace it behind `/api/messages`.
- Search is term matching with trigram indexes; relevance ranking would benefit from `tsvector` or a search engine at larger scale.
- Feed ranking scores up to 400 recent candidates per request; at scale, precompute candidate sets (fan-out on write) and cache.
- Posts are public to signed-in members and visitors (no per-post audience yet); private project updates are visible to the team only through the admin pages.
- Group conversations, comment reactions, post editing and link previews (which need SSRF-safe fetching) are not implemented.
- OAuth sign-in is prepared in the data model but not wired to providers.
- 404s for streamed pages return status 200 with `noindex`; a proxy-level existence check could return real 404s if analytics require it.
