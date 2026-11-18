# Delivery report by phase

The repository started empty. Stack chosen: Next.js 16 + PostgreSQL 16 + Prisma 7 as a modular monolith (see ARCHITECTURE.md). The first slice built end to end was: sign up → profile → project → opportunity → search → application → review.

Totals: 50 pages, 8 route handlers, 70 server actions, about 16.5k lines of TypeScript (excluding generated code). Automated tests: 39 unit/integration tests (Vitest, real Postgres) and 13 end-to-end tests (Playwright on the production build, including mobile and axe accessibility checks). Typecheck, lint and production build are clean.

## Phase 1 — Foundation

**Delivered**
- Project structure, environment validation, structured logging, error model, Prisma schema and SQL migration (constraints, partial unique indexes, trigram indexes).
- Auth: sign up, sign in/out, email verification (single-use tokens, resend), password reset, change password/email, sessions list and revocation, deactivation (reactivates on next login), permanent deletion, data export; scrypt hashing; DB-backed rate limits.
- Profiles: photo, cover, headline, bio, location, languages, links, experience, education, skills, interests, multi-select availability, experience level, work mode and collaboration preferences, privacy settings.
- Organizations with OWNER/ADMIN/EDITOR/MEMBER roles, invitations, role changes, ownership transfer, archiving.
- Tag system: normalization with aliases, autocomplete, usage counts, tag pages linking people, projects, opportunities and posts.
- Design system, app shell (top navigation + mobile bottom bar), landing page, legal pages, loading/empty/error states.

**Tests**: auth flows (signup, duplicates, login, rate limiting, verification, reset, password change, deactivation/suspension, erasure, export), tag and validation unit tests.

## Phase 2 — Projects and opportunities

**Delivered**
- Projects: create/edit, public or private, stage, category, technologies, topics, goals and needs, links, gallery, owning organization, team with titles and roles, invitations, archiving, ownership transfer.
- Opportunities (“Looking for”) owned by a project, an organization or a person: all requested fields, drafts, publish/close/reopen/mark filled/archive, feed announcement, matching notifications.
- Discovery with combinable filters and sorting for opportunities, projects, people and organizations; global search overview.
- Applications as a person or on behalf of an organization, duplicate prevention, withdrawal and re-application, status workflow with history and notes, acceptance adds the applicant to the project team linked to the opportunity; sent and received application pages.

**Tests**: scenario A/B/E end to end (service level and browser), closed/archived opportunities, privacy of private projects, permission checks for editors/strangers, people search privacy.

## Phase 3 — Social

**Delivered**
- Feed (“For you” ranked + “Latest”), composer with post types, images, links, @mention autocomplete and posting as a project/organization.
- Likes (optimistic, idempotent), comments with one level of replies, shares and quote-shares, saved posts, hashtags, post permalinks, delete by author/entity admins.
- Follows for people, projects and organizations (with optional approval for people), connection requests with accept/decline/cancel/remove, mirrored-request handling, cooldown after decline, mutual connections, people you may know.

**Tests**: scenario D and F at service level and in the browser; counters; threading; moderation removal.

## Phase 4 — Advanced networking

**Delivered**
- Private messaging with permission rules, blocking, unread indicators, polling updates and “seen” state.
- In-app notifications for all requested events, per-type preferences, email digest job.
- Project invitations, partnerships between projects and organizations (requests, accept/decline/cancel/end, visible on both pages), complementary-project suggestions.
- Explainable, configurable matching used for recommendations, sorting and notifications.

**Tests**: scenario C and G end to end; messaging permissions and unread state; notification preferences and digests; organization roles and delegated project permissions; matching engine unit tests.

## Phase 5 — Quality and production readiness

**Delivered**
- Moderation console (reports queue, remove/restore content, suspend accounts, audit log); reporting from posts, comments, profiles, projects, organizations and opportunities.
- Security headers (CSP, HSTS, frame/sniff/referrer/permissions policies), CSRF checks for route handlers, upload hardening.
- Accessibility: skip link, labelled controls and landmarks, keyboard-operable menus and dialogs, live regions for toasts and form errors, sufficient contrast (verified with axe on public pages).
- Responsive layouts verified at phone width (no horizontal scrolling on key pages).
- Docker image (standalone output), docker-compose stack, CI workflow, documentation.

**Tests**: E2E security checks (redirects for signed-out users, private project isolation, cross-site upload rejection), axe on five public pages, mobile layout checks.

## Remaining work and limitations

See ARCHITECTURE.md §11. In short: real-time transport (polling today), richer search ranking, post audiences, group chats, post editing, link previews, OAuth providers, S3 storage for multi-instance deployments, and a review of the legal page templates by counsel before launch.
