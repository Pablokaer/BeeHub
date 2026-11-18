# BeeHub

**Turn skills, ideas and needs into real collaboration.**

BeeHub is a collaboration platform where people, projects and organizations find each other, publish what they are **looking for**, apply, form teams and build partnerships. Think of it as a hive: everyone brings a different skill to the same work. Bia, the pixel-art bee, is its mascot.

_BeeHub was previously called Collab Hub. Internal identifiers (npm package, database names, cookies, test domains) keep the old `collab-hub` / `collab_hub` names on purpose: renaming them would sign everyone out and break existing databases without any visible benefit._

---

## Contents

1. [Concept](#concept)
2. [Features](#features)
3. [How it works](#how-it-works)
4. [Technology](#technology)
5. [Getting started](#getting-started)
6. [Scripts](#scripts)
7. [Testing](#testing)
8. [Project structure](#project-structure)
9. [Deployment and CI](#deployment-and-ci)
10. [Further documentation](#further-documentation)

---

## Concept

Most networks are built around jobs. BeeHub is built around **collaboration of any kind**: a student looking for a first open-source contribution, a freelancer looking for paid work, a founder looking for a co-founder, a community looking for volunteers, a company looking for a partner for a pilot.

The product rests on **four connected entities**, linked by a shared vocabulary of tags (skills, technologies and topics):

| Entity | What it is |
| --- | --- |
| **People** | Members with a profile: skills, interests, availability, experience, education, links and a network. |
| **Organizations** | Startups, companies, nonprofits, communities and academic groups, with members and roles. |
| **Projects** | Things being built, with a stage (idea → scaling), a team, a gallery, needs and partners. Public or private. |
| **Opportunities** | What someone is looking for: paid roles, freelance, volunteering, co-founders, internships, mentorship, academic work, business or project partnerships, service exchange. |

The core loop:

```
create a profile ─▶ discover people, projects and opportunities ─▶ apply or connect
        ▲                                                               │
        └────── share progress in the feed ◀── form a team / partnership ┘
```

**One account, many hats.** A person can own several projects and organizations and act on their behalf (post as a project, publish an opportunity as an organization, apply as an organization), always within role-based permissions.

**Explainable by design.** Recommendations and feed ranking use simple, configurable rules, and every match is shown with its reasons. Only professional signals are used; no sensitive attributes are stored or considered.

---

## Features

### Profiles
- Name, headline, bio (with @mentions and #hashtags), location (can be hidden), languages, links.
- Skills and interests with suggestion chips and autocomplete; availability (open to collaborate, looking for projects, hiring, paid work, volunteering, co-founding, networking); experience level; preferred work modes and collaboration types.
- Work experience and education history.
- **Profile picture and cover**: pick an illustration from the Colmeia catalog, or upload a photo. Uploaded profile photos are turned into a **pixel portrait** in the BeeHub style (the original is kept privately); covers stay as photos.
- Profile page with cover, honeycomb portrait, network counters that open the real lists, and **Posts / Projects / About** tabs.
- Privacy: public or members-only profile, location visibility, who can see connections, who can message, follow approval, search visibility.

### Organizations and projects
- Create organizations (type, size, industry, tagline, logo, cover, tags) and projects (category, stage, open source, beginner-friendly, repository, technologies, topics, goals, needs, logo, cover, gallery).
- Teams with roles (**owner, admin, editor, member**) and titles; invitations by username that can be accepted or declined.
- **Partnerships** between projects and organizations (request, accept, shown on both pages).
- Private projects visible only to their members.

### Opportunities and applications
- Publish opportunities as yourself, a project or an organization: category, collaboration type, work mode, location, experience, commitment, duration, compensation, deadline, required skills and topics. Drafts are supported.
- Browse with filters and **best match** sorting.
- Apply as yourself or on behalf of an organization, with a message and portfolio link.
- Owners manage received applications through a status workflow: received → in review → contacted → accepted / rejected (applicants can withdraw).

### Matching and recommendations
- Deterministic scoring between a person and an opportunity, weighted by required skills, topics, interests, collaboration type, availability, work mode, experience and location (on-site roles only). Every score comes with human-readable reasons.
- Used for "Opportunities for you", "People to meet", best-match sorting and match notifications when a new opportunity is published.

### Discover and search
- One search across people, projects, organizations, opportunities and posts, with filters (skills, interests, availability, experience, stage, category and more) and tag pages (`/tags/[slug]`).

### Network
- Mutual **connections** with requests (optional note), acceptance, withdrawal and removal.
- **Follows** for people, projects and organizations, with optional approval.
- Mutual connections shown on profiles; blocking and reporting.

### Feed and posts
- Post as yourself, a project or an organization: text, up to four images, a link, post type (update, launch, achievement, help request, discussion, partnership), @mentions and #hashtags.
- Likes, comments with replies, shares and quote-shares, saved posts.
- **For you** (ranked) and **Latest from your network** modes. Each post shows why it is in your feed ("From your network", "Matches your skills"…).

### Messaging and notifications
- One-to-one conversations with unread state, respecting message permissions and blocks.
- In-app notifications for connections, follows, comments, replies, likes, shares, mentions, messages, applications, matches, invitations, partnerships and updates from followed entities, with per-type preferences and optional **email digests**.

### Settings, data and safety
- Account settings, privacy, notification preferences, blocked members.
- **Data export** (JSON) and **account deletion**.
- Reports on people, posts and other content, a **moderation console** for staff, and an audit log of sensitive actions.
- Personal **analytics**: followers, connections, posts and interactions over the last 30 days, visible only to you.

### Visual identity (Colmeia)
- Honey and cocoa palette with **day and night themes** (saved per browser, applied before first paint).
- Stepped pixel frames, honey buttons, honeycomb portraits, pixel-art icons, an apiary scene and Bia in the navigation.
- A catalog of pixel-art covers and avatars (`public/brand/colmeia/catalogo.json`) that members can choose voluntarily.
- Responsive from 320 px: a navigation rail on desktop and tablet, a 3 × 2 navigation grid on phones.

---

## How it works

### Request flow

```
Browser
  │  pages (Server Components) / Server Actions / route handlers
  ▼
src/app/**            thin adapters: read session → validate input (Zod) → call a service → refresh
  ▼
src/server/**         domain services: business rules, authorization, rate limits, notifications
  ▼
Prisma 7 (pg adapter) ─▶ PostgreSQL 16 (constraints, trigram indexes)
```

- **Authorization lives in services**, never only in the UI: every service receives the acting user explicitly and checks roles and visibility (see `docs/security/authz-matrix.md`).
- **Validation** uses shared Zod schemas (`src/lib/validation.ts`) for forms, actions, route handlers and services alike.
- **Rendering** uses Next.js Cache Components: pages are partially prerendered and personalized parts stream behind `<Suspense>` boundaries.

### Accounts and sessions
- Passwords are hashed with **scrypt** (OWASP parameters); sessions are random tokens stored only as SHA-256 hashes, sent in an HTTP-only cookie.
- Email verification and password reset use single-use, expiring tokens. Unverified members can browse but not publish, apply, connect or message.
- Usernames (the `/u/…` address) are generated from the name at signup and share one namespace with organization and project handles.

### Media
1. Uploads go to `POST /api/uploads` (same-origin check, rate limited). Images are decoded and re-encoded to WebP with **sharp**, and all metadata (EXIF, GPS) is removed.
2. **Profile photos** become a 48 × 48 pixel portrait on the server (`src/server/media/pixel-portrait.ts`): bust crop, detail-preserving reduction, a palette leaning toward the brand tones (skin tones are preserved), a flat backdrop and cocoa contours. No external service is involved. The re-encoded original is stored separately and readable only by its owner.
3. Files are served by `GET /api/media/…`, which re-checks on every request that the viewer may see the image (profile visibility, project privacy, deleted posts, blocks).
4. Catalog illustrations are static files and are stored on profiles only as validated ids.

### Feed ranking
Candidate posts from the last 21 days are scored with explainable signals (your own posts, connections, followed people, followed projects and organizations, your teams, opportunity posts matching your skills, shared tags, engagement) and multiplied by a recency decay with a 36-hour half-life. Weights live in `src/config/feed.ts`.

### Matching
Weights add up to 100 (required skills 40, availability 15, topics 10, interests 10, collaboration type 10, work mode 5, experience 5, location 5). Items appear in recommendations from a score of 35; publishing an opportunity notifies up to 50 members scoring 60 or more. See `src/config/matching.ts`.

### Search
Text search uses PostgreSQL `ILIKE` backed by `pg_trgm` GIN indexes, combined with tag filters (AND of ORs) and visibility rules.

### Notifications and email
Services create notifications as side effects of actions. Emails are written to a database **outbox** first; with `SMTP_URL` they are delivered, otherwise they stay readable at `/dev/mailbox` in development. Digests are sent by `npm run notifications:email` or `POST /api/cron/notification-emails` (protected by `CRON_SECRET`).

### Protection
Content Security Policy and security headers on every response, same-origin checks on mutating endpoints, user content never rendered as HTML, rate limits stored in Postgres (so they hold across instances), blocking, reports and an audit log. See `docs/security/`.

---

## Technology

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, Cache Components, Server Actions, `proxy.ts`), **React 19**, **TypeScript** |
| Data | **PostgreSQL 16**, **Prisma 7** with the `pg` driver adapter; SQL migrations with CHECK constraints, `citext` and `pg_trgm` |
| Validation | **Zod 4**, shared by forms, actions and services |
| UI | **Tailwind CSS 4** with semantic design tokens; Colmeia components in `src/styles/colmeia.css`; **IBM Plex Sans** for text and **Pixelify Sans** for short headings (self-hosted with `next/font`); pixel-art SVG glyphs plus `lucide-react` icons |
| Images | **sharp**: validation, re-encoding, metadata removal and the pixel-portrait filter |
| Email | **nodemailer** over SMTP with a database outbox |
| Tests | **Vitest** (unit and integration against a real Postgres), **Playwright** (end-to-end, mobile, accessibility with **axe-core**) |
| Delivery | Docker (standalone Next.js output), Docker Compose, GitHub Actions |

---

## Getting started

**Requirements:** Node.js 22+ and PostgreSQL 16+ (the `citext` and `pg_trgm` extensions ship with Postgres).

```bash
cp .env.example .env            # adjust DATABASE_URL if needed
npm install                     # also generates the Prisma client
npm run db:migrate              # apply migrations
npm run db:seed                 # optional: demo data
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public base URL (links in emails, metadata) |
| `REQUIRE_EMAIL_VERIFICATION` | Require a confirmed email to publish, apply, connect and message |
| `SESSION_TTL_DAYS` | Session lifetime |
| `SMTP_URL` / `MAIL_FROM` | Email delivery (leave `SMTP_URL` empty to use the dev mailbox) |
| `UPLOAD_DIR` / `UPLOAD_MAX_MB` | Where uploads are stored and their size limit |
| `LOG_LEVEL` | Structured log level |
| `CRON_SECRET` | Protects the notification email endpoint |

### Demo data

`npm run db:seed` creates demo members, organizations, projects, opportunities, applications, posts, connections and partnerships. All demo accounts use the password `collab-demo-2026`: `ana@demo.collabhub.local` (project and organization owner), `bruno@…` (student), `carla@…`, `diogo@…`, `elena@…`, `farid@…`, `grace@…`, and `morgan@…` (admin, sees `/moderation`).

To review the product with a fuller community around an existing account, run `npm run db:placeholders -- you@example.com`. It fills that account's profile in every field and adds fictitious people, organizations, public and private projects, galleries, opportunities, applications, connections, follows, posts, comments, shares, partnerships, invitations and conversations, all through the service layer. It runs once per database and refuses to run in production.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Route types + `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Unit and integration tests (uses the database in `.env.test`) |
| `npm run test:e2e` | Playwright end-to-end tests against the production build on port 3100 (run `npm run build` first; uses `collab_hub_e2e`) |
| `npm run db:migrate` / `db:migrate:dev` | Apply / create migrations |
| `npm run db:seed` / `db:reset` | Demo data / reset the database |
| `npm run db:placeholders -- <email>` | Fill an account and its surroundings with fictitious data (local only) |
| `npm run notifications:email` | Send queued notification email digests |
| `npm run perf:seed` / `perf:services` / `perf:http` | Large synthetic dataset and performance measurements |

---

## Testing

- **Unit** (`tests/unit`): validation, tags, slugs, matching, the pixel-portrait filter and other pure logic.
- **Integration** (`tests/integration`): services against a real Postgres: auth, social graph, collaboration flows, media access and profile images.
- **End-to-end** (`tests/e2e`): signup and email confirmation, profile editing, catalog art and photo upload, posting with images, connections, applications, partnerships, mobile layout, security and accessibility (axe).

Create the `collab_hub_test` and `collab_hub_e2e` databases once (owned by the app user); the test runners apply migrations automatically. End-to-end tests run against a production build, where the real rate limits apply; the e2e helpers reset only the signup counter in the e2e database between signups.

---

## Project structure

```
prisma/                 schema, migrations (constraints, search indexes), demo seed
public/brand/           Bia artwork and the Colmeia catalog (covers, avatars, manifest)
src/app/                routes
  (site)/               landing, terms, privacy
  (auth)/               sign in, sign up, password reset, email confirmation
  (app)/                the product: feed, discover, opportunities, network, messages,
                        notifications, profiles (/u), projects (/p), organizations (/o),
                        management pages, settings, saved, analytics, moderation
  actions/              server actions (session → validate → service → refresh)
  api/                  uploads, media, tag and mention autocomplete, message polling,
                        data export, health, cron
src/server/             domain services: auth, authz, profiles, organizations, projects,
                        opportunities, applications, posts, feed, search, matching,
                        messaging, notifications, partnerships, invitations, moderation,
                        uploads and media (incl. the pixel-portrait filter)
src/lib/                isomorphic code: validation, labels, tags, text, matching engine,
                        art catalog, media keys
src/config/             tunable feed, matching and promotion settings
src/components/         shared UI: ui/ primitives, shell (header, rail, theme), colmeia/
                        (pixel glyphs, apiary, blocks), cards, composer, post actions
src/styles/colmeia.css  Colmeia visual language (frames, buttons, portraits, layout)
scripts/                notification emails, performance tools, brand assets, demo data
tests/                  unit, integration (Vitest) and e2e (Playwright)
docs/                   architecture, phases, audit, security and design references
```

---

## Deployment and CI

- `docker compose up --build` starts Postgres, runs migrations once and serves the app on port 3000 (standalone Next.js output, non-root user, health check on `/api/health`).
- For multiple instances: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, configure `SMTP_URL`, put uploads on a shared volume (or swap the storage module for S3-compatible storage), and schedule the notification email job.
- GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, unit and integration tests, the production build and the end-to-end suite on every push to `main` and on pull requests.

---

## Further documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Design decisions |
| [docs/PHASES.md](docs/PHASES.md) | What each delivery phase added |
| [docs/AUDIT.md](docs/AUDIT.md) | Production-readiness audit and prioritized gaps |
| [docs/security/](docs/security/) | Threat model, authorization matrix, security review |
| [docs/design/colmeia/README.md](docs/design/colmeia/README.md) | Colmeia visual direction, catalog and implementation notes |
