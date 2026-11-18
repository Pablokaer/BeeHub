# BeeHub

_Formerly Collab Hub. Internal identifiers (package, database names, cookies) keep the old `collab-hub` / `collab_hub` names._

A professional collaboration platform where people, projects and organizations discover each other, publish what they are **looking for**, apply, form teams and establish partnerships.

It combines a professional network (profiles, connections, follows, feed), project showcases (teams, stages, galleries, partnerships) and an opportunity marketplace that is not limited to jobs: freelance, volunteering, co-founding, internships, mentorship, academic work, business and project partnerships, and service exchange.

## Highlights

- **Four connected entities**: people, organizations, projects and opportunities, linked by a shared tag vocabulary (skills, technologies, topics).
- **One account, many hats**: a person can own several projects and organizations and publish, apply or post on their behalf, with role-based permissions (owner, admin, editor, member).
- **Looking For**: projects, organizations and individuals publish opportunities; members apply (as themselves or on behalf of an organization) and follow a tracked status workflow.
- **Explainable matching**: deterministic, configurable scoring between people and opportunities, always shown with its reasons. Used for recommendations, “best match” sorting and notifications.
- **Professional network**: mutual connections with acceptance, follows (with optional approval), feed with rule-based ranking, posts as yourself/project/organization, likes, comments with replies, shares and quote-shares, @mentions, #hashtags, saved posts.
- **Messaging and notifications**: 1:1 conversations with unread state, permission rules and blocking; in-app notifications with per-type preferences and email digests.
- **Safety and privacy**: server-side authorization, rate limiting, CSRF/XSS protections, reports and a moderation console, audit log, GDPR export and erasure.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript |
| Data | PostgreSQL 16, Prisma 7 (driver adapter `pg`), SQL migrations with CHECK constraints and trigram indexes |
| UI | Tailwind CSS 4 with design tokens, IBM Plex type, lucide icons; light and dark themes |
| Validation | Zod schemas shared by forms and services |
| Images | sharp (decode, resize, strip metadata, re-encode to WebP) |
| Email | nodemailer over SMTP, with a database outbox (dev mailbox when SMTP is not configured) |
| Tests | Vitest (unit + integration against a real Postgres), Playwright (E2E, mobile, axe accessibility) |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions and [docs/PHASES.md](docs/PHASES.md) for what each phase delivered.

## Getting started

Requirements: Node.js 22+, PostgreSQL 16+ (with the `citext` and `pg_trgm` extensions, available by default).

```bash
cp .env.example .env            # adjust DATABASE_URL if needed
npm install                     # also generates the Prisma client
npm run db:migrate              # applies migrations
npm run db:seed                 # optional: demo data
npm run dev                     # http://localhost:3000
```

Demo accounts (after seeding) use the password `collab-demo-2026`:
`ana@demo.collabhub.local` (project and organization owner), `bruno@…` (student), `carla@…`, `diogo@…`, `elena@…`, `farid@…`, `grace@…`, and `morgan@…` (admin, sees `/moderation`).

Without `SMTP_URL`, emails (verification, password reset, digests) are stored in the outbox and readable at **/dev/mailbox** in development.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Route types + `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Unit and integration tests (uses the database in `.env.test`) |
| `npm run test:e2e` | Playwright E2E against the production build on port 3100 (run `npm run build` first; uses `collab_hub_e2e`) |
| `npm run db:migrate` / `db:migrate:dev` | Apply / create migrations |
| `npm run db:seed` / `db:reset` | Demo data / reset the database |
| `npm run notifications:email` | Send queued notification email digests (schedule it, or call `POST /api/cron/notification-emails`) |

Test databases: create `collab_hub_test` and `collab_hub_e2e` once (owned by the app user); migrations are applied automatically by the test runners.

## Project structure

```
prisma/                 schema, migrations (incl. constraints and search indexes), seed
src/app/                routes
  (site)/               landing, terms, privacy
  (auth)/               sign in, sign up, password reset, email confirmation
  (app)/                the product: feed, discover, opportunities, network, messages,
                        notifications, profiles (/u), projects (/p), organizations (/o),
                        admin pages, settings, moderation
  actions/              server actions (thin adapters: auth → validate → service → refresh)
  api/                  route handlers: uploads, media, tag/mention autocomplete,
                        message polling, data export, health, cron
src/server/             domain services (auth, authz, profiles, organizations, projects,
                        opportunities, applications, posts, feed, search, matching,
                        messaging, notifications, partnerships, invitations, moderation)
src/lib/                isomorphic code: validation, labels, tags, text tokenizer, matching engine
src/config/             tunable matching and feed weights
src/components/         shared UI (ui/ primitives, cards, composer, post actions, shell)
tests/                  unit, integration (Vitest) and e2e (Playwright)
docs/                   architecture and phase reports
```

## Deployment

`docker compose up --build` starts Postgres, runs migrations once and serves the app on port 3000 (standalone Next.js output, non-root user, health check on `/api/health`). For multiple instances set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, configure `SMTP_URL`, put uploads on a shared volume (or swap the storage module for S3-compatible storage), and schedule the notification email job. A GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck, lint, unit/integration tests, the build and the E2E suite.
