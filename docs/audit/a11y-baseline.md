# Accessibility baseline (M0)

_Audit only — no product code was changed. Run on 2026-11-11 against the existing production build (`next start -p 3200`, DB `collab_hub` with seed data)._

> **A manual screen-reader pass (VoiceOver + Safari, NVDA + Firefox/Chrome) is still required.** Everything below comes from automated tooling (axe-core, Playwright keyboard scripting, Chromium accessibility-tree snapshots). That can show how roles and names are exposed, but not how a screen reader actually announces them, how live regions are spoken, or how the virtual cursor behaves.

## TL;DR

- **180 axe scans** over **all 54 `page.tsx` routes** (70 route × auth combinations: 22 signed out, 47 signed in as ana, 1 as morgan), light + dark at 1280×800, plus light + dark at 360×800 for 20 main pages. 0 scans errored.
- **WCAG tags (wcag2a/2aa/21a/21aa/22aa): 134 rule-instances, all `serious`, 604 nodes. 0 critical, 0 moderate, 0 minor.** Five rules: `target-size` (392 nodes), `link-in-text-block` (82), `label-content-name-mismatch` (68), `color-contrast` (58, dark mode only), `list` (4). axe also left 92 nodes "incomplete" (needs review): `link-in-text-block` 70, `color-contrast` 22.
- A separate **best-practice** pass (light variants only, not counted above) found 6 more rules: `landmark-unique`, `region`, `page-has-heading-one`, `heading-order`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`.
- The **keyboard walkthrough** found the biggest problems, and axe cannot see them. **Focus drops to `<body>` after almost every in-place action**: invalid submit on 4 of 5 forms, publishing a post, Like, comment, Connect/Withdraw, Apply, Escape from the Share menu, and closing the Report dialog. At 360px, **the fixed bottom nav hides focused elements** (WCAG 2.4.11) and comes **before `<main>` in tab order**.
- **Notifications list:** every item's accessible name is only "Open" or "Open (unread)", so screen-reader users can't tell notifications apart.
- **404 handling:** entity pages that don't exist (and private ones) return **HTTP 200** with the not-found UI plus `noindex`. Unknown routes return 404.

## Method

| Part | Tooling | Files |
|---|---|---|
| axe sweep | `@axe-core/playwright` (axe 4.x) with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`; extra `best-practice` pass on light variants, stored separately | `docs/audit/a11y/a11y-sweep.spec.ts` → `results/sweep/<auth>--<variant>.json` |
| Variants | `light-desktop`, `dark-desktop` (1280×800, `colorScheme` set on context + `emulateMedia`) for every route; `light-360`, `dark-360` (360×800, `isMobile`, `hasTouch`) for the 20 "main" pages | same |
| Auth | signed out; `ana@demo` (owns project `studypilot`, org `nova-labs`) for member/manage pages; `morgan@demo` (ADMIN) for `/moderation`. Sign-in + fixture lookup in `a11y-auth.setup.ts` (ids/slugs resolved from the DB) | `results/fixtures.json` |
| Target size | axe `target-size` (2.5.8) **plus** our own measurement of all visible interactive elements < 24×24 on main pages, with inline-link and 24px-circle spacing exceptions approximated, and the conflicting neighbour recorded | `results/summary.json` → `smallTargetsFailing` |
| Keyboard | `a11y-keyboard.spec.ts`: Tab / Shift+Tab / Enter / Space / Escape / Arrow keys only (no clicks; `page.goto` only as entry point). After every key, records `document.activeElement` and its computed outline / box-shadow / border **after the 150ms `transition-colors`** (the transition animates `outline-color`, so earlier samples read the wrong colour), and computes indicator contrast against the nearest opaque background | `results/keyboard.json` |
| SR proxy | `locator.ariaSnapshot()` of `body` and `main` for feed, profile (`/u/diogo`), opportunity (`/opportunities/<pixel-garden id>`), conversation (`/messages/<ana↔bruno>`), at desktop and 360; landmark list derived from the snapshot; heading outline, images, live regions, unnamed controls from the DOM | `results/aria/*.yml`, `results/aria/structure-*.json` |
| Other | HTTP status probes with `maxRedirects: 0` (`status-codes.json`); computed transitions/animations under `reducedMotion: reduce` (`reduced-motion.json`); grep of `src/**` and the built CSS for motion; `<title>` and `lang` on every scan | |

Rerun (server on :3200 first, see the header of `docs/audit/a11y/playwright.a11y.config.ts`):
```
npx playwright test -c docs/audit/a11y/playwright.a11y.config.ts      # ~8 min: setup → sweep → aria → keyboard
node docs/audit/a11y/summarize.mjs                                     # rebuilds results/summary.json + Markdown tables
docker exec -i collab-hub-pg psql -U hub -d collab_hub -v since="'<UTC start time>'" < docs/audit/a11y/cleanup.sql
```
**Data side effects:** the keyboard flows really publish a post, comment, like/unlike, send and withdraw a connection request (ana→elena), apply to an opportunity and send a message. Setup also creates a private project `a11y-audit-private`. Everything is tagged `[a11y-audit]`, and `cleanup.sql` was run after the final run: the DB is back to seed counts. The only leftover is login sessions.

## Routes covered

LD = light 1280, DD = dark 1280, L360/D360 = 360×800. Each cell is the count of distinct serious+critical rules, with failing nodes in brackets. "Moderate+minor" counts WCAG-tagged rules only (none were found). The best-practice column is the number of best-practice rules hit on the light variants.

| Route | Auth | HTTP | Theme / viewport scanned | Serious+critical rules (nodes) LD / DD / L360 / D360 | Moderate+minor (WCAG tags) | Best-practice rules (light) | Rules hit |
|---|---|---|---|---|---|---|---|
| `/` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 0 | — |
| `/login` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 1 | — |
| `/signup` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 1 | — |
| `/discover` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 1 | — |
| `/opportunities` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (37) / 1 (37) / 1 (37) / 1 (37) | 0 | 2 | target-size |
| `/opportunities/[id]` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 0 | — |
| `/u/[username]` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (2) / 1 (2) / 0 (0) / 0 (0) | 0 | 0 | link-in-text-block |
| `/p/[slug]` | signed-out | 200 | L-desktop, D-desktop, L-360, D-360 | 2 (5) / 2 (5) / 1 (3) / 1 (3) | 0 | 0 | link-in-text-block, target-size |
| `/privacy` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 0 | — |
| `/terms` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 0 | — |
| `/forgot-password` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 1 | — |
| `/reset-password` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 1 | — |
| `/reset-password (bad token)` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 1 | — |
| `/verify-email` | signed-out | 200 | L-desktop, D-desktop | 1 (1) / 1 (1) / – / – | 0 | 1 | link-in-text-block |
| `/verify-email (bad token)` | signed-out | 200 | L-desktop, D-desktop | 1 (1) / 1 (1) / – / – | 0 | 1 | link-in-text-block |
| `/discover?type=projects` | signed-out | 200 | L-desktop, D-desktop | 1 (38) / 1 (38) / – / – | 0 | 2 | target-size |
| `/u/[username]/connections` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 0 | — |
| `/o/[slug]` | signed-out | 200 | L-desktop, D-desktop | 1 (1) / 1 (1) / – / – | 0 | 0 | target-size |
| `/posts/[id]` | signed-out | 200 | L-desktop, D-desktop | 2 (4) / 2 (4) / – / – | 0 | 1 | link-in-text-block, target-size |
| `/tags/[slug]` | signed-out | 200 | L-desktop, D-desktop | 2 (5) / 2 (5) / – / – | 0 | 0 | link-in-text-block, target-size |
| `404: /u/does-not-exist` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 3 | — |
| `404: /p/[private]` | signed-out | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 3 | — |
| `/feed` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 2 (13) / 3 (14) / 2 (15) / 3 (16) | 0 | 1 | color-contrast, link-in-text-block, target-size |
| `/opportunities/[id] (applicant view)` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 1 (1) / 0 (0) / 1 (1) | 0 | 0 | color-contrast |
| `/messages` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 1 (1) / 0 (0) / 1 (1) | 0 | 0 | color-contrast |
| `/messages/[id]` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (1) / 2 (3) / 1 (1) / 2 (3) | 0 | 1 | color-contrast, list |
| `/network` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (1) / 2 (2) / 1 (1) / 2 (2) | 0 | 0 | color-contrast, link-in-text-block |
| `/notifications` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (17) / 2 (18) / 1 (17) / 2 (18) | 0 | 0 | color-contrast, label-content-name-mismatch |
| `/p/[slug]` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 2 (5) / 3 (6) / 1 (3) / 2 (4) | 0 | 0 | color-contrast, link-in-text-block, target-size |
| `/posts/[id]` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 2 (3) / 3 (4) / 2 (3) / 3 (4) | 0 | 1 | color-contrast, link-in-text-block, target-size |
| `/profile/edit` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 1 (1) / 0 (0) / 1 (1) | 0 | 0 | color-contrast |
| `/projects/[slug]/manage` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 1 (1) / 0 (0) / 1 (1) | 0 | 0 | color-contrast |
| `/settings` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 1 (1) / 0 (0) / 1 (1) | 0 | 0 | color-contrast |
| `/u/[username] (other)` | ana | 200 | L-desktop, D-desktop, L-360, D-360 | 1 (2) / 2 (3) / 0 (0) / 1 (1) | 0 | 0 | color-contrast, link-in-text-block |
| `/discover` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 1 | color-contrast |
| `/opportunities` | ana | 200 | L-desktop, D-desktop | 1 (37) / 2 (38) / – / – | 0 | 2 | color-contrast, target-size |
| `/opportunities/new` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/opportunities/manage` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/opportunities/[id] (owner view)` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/opportunities/[id]/edit` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/applications` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/applications/received` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/dev/mailbox` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 3 | color-contrast |
| `/my-projects` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/network/invitations` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/network/requests` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/o/[slug]` | ana | 200 | L-desktop, D-desktop | 1 (1) / 2 (2) / – / – | 0 | 0 | color-contrast, target-size |
| `/orgs/new` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/orgs/[slug]/manage` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/orgs/[slug]/manage/members` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/orgs/[slug]/manage/partners` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/orgs/[slug]/manage/settings` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/projects/new` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/projects/[slug]/manage/gallery` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/projects/[slug]/manage/partners` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/projects/[slug]/manage/settings` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/projects/[slug]/manage/team` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/saved` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/settings/blocked` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/settings/data` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/settings/notifications` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/settings/privacy` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/tags/[slug]` | ana | 200 | L-desktop, D-desktop | 2 (5) / 3 (6) / – / – | 0 | 0 | color-contrast, link-in-text-block, target-size |
| `/u/[username] (own)` | ana | 200 | L-desktop, D-desktop | 1 (1) / 2 (2) / – / – | 0 | 0 | color-contrast, target-size |
| `/u/[username]/connections` | ana | 200 | L-desktop, D-desktop | 0 (0) / 1 (1) / – / – | 0 | 0 | color-contrast |
| `/ (signed in)` | ana | 200 → `/feed` | L-desktop, D-desktop | 2 (13) / 3 (14) / – / – | 0 | 1 | color-contrast, link-in-text-block, target-size |
| `/privacy` | ana | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 0 | — |
| `/terms` | ana | 200 | L-desktop, D-desktop | 0 (0) / 0 (0) / – / – | 0 | 0 | — |
| `/moderation` | morgan | 200 | L-desktop, D-desktop, L-360, D-360 | 0 (0) / 0 (0) / 0 (0) / 0 (0) | 0 | 0 | — |

Notes: `/ (signed in)` redirects to `/feed`. `/dev/mailbox` renders the not-found page in production (200 + `noindex`). The dark-mode `color-contrast` hit on every signed-in page comes from the unread badge in the nav (ana has unread notifications; morgan has none, so `/moderation` is clean).

## Violations by rule (WCAG tag set)

### `target-size` — serious — 392 nodes / 38 scans (2.5.8 Target Size Minimum)
- **Filter checkboxes**: 14×14 `<input type="checkbox" class="size-3.5">` inside label rows about 20px tall (`FilterCheck`, `src/components/filters.tsx`). `/opportunities` (37 nodes: `input[value="PAID"]`, `input[value="FREELANCE"]`, `input[value="VOLUNTEER"]`, …) and `/discover?type=projects` (38: `input[name="open"]`, `input[name="beginners"]`, `input[name="oss"]`, `input[value="IDEA"]`). Seen signed in and out, light and dark, desktop and 360. Whether the label counts as part of the target still needs a manual check. axe and our own measurement both flag it.
- **Entity name links in card/post headers**: `a.block.truncate.text-sm` 20px tall, ≈170×20, sitting directly above the "by … · 18 minutes ago" meta links (spacing diameter 20.4px). Sample: `article[aria-label="Post by Ana Ribeiro"] … > .block.truncate[href$="studypilot"]`, `.block.truncate[href$="nova-labs"]`, `[href$="openharbor"]`. Routes: `/feed`, `/`→feed, `/p/[slug]`, `/posts/[id]`, `/o/[slug]`, `/tags/[slug]`, `/u/ana`.

### `link-in-text-block` — serious — 82 nodes / 32 scans (1.4.1 Use of Color)
- Links inside running text are shown only by colour (no underline until hover). Light: accent `#1d5c4d` on ink `#1b1a17`. Dark: `#5fb39a` vs `#eceae4`, **2.07:1**. Muted text in dark: **1.16:1**. Samples: hashtags and mentions in posts `.prose-plain … > .link[href$="education"]`, `a[href$="artificial-intelligence"]`, `a[href$="gamedevelopment"]`; `.link` on `/network`, `/verify-email`, profile About. Routes: `/feed`, `/posts/[id]`, `/tags/[slug]`, `/p/[slug]`, `/u/[username]`, `/network`, `/verify-email`. axe left another 70 nodes of this rule as "incomplete".

### `label-content-name-mismatch` — serious — 68 nodes / 4 scans (2.5.3 Label in Name; effectively 4.1.2)
- `/notifications`: each notification is a `<button aria-label="Open">` or `"Open (unread)"` wrapping the notification text (`src/app/(app)/notifications/notification-link.tsx:13`). The `aria-label` **replaces** the text, so every item is announced only as "Open". Targets: `button[aria-label="Open"]`, `.items-start.py-3[aria-label="Open (unread)"]`. 17 per scan.

### `color-contrast` — serious — 58 nodes / 56 scans (1.4.3), dark scheme only
- Unread badge in the top nav and bottom nav: white on `--c-signal` dark `#f08a5d`, **2.47:1** at 10px. Targets: `.min-w-4.bg-signal.font-mono` inside `a[href$="notifications"]`, and `.right-[calc(50%-18px)]` (bottom nav). Appears on every signed-in page in dark mode.
- `/messages/[id]`: timestamp in your own bubble, `.text-accent-ink/70` (`#0d1f1a` at 70% on `#5fb39a`).
- axe left another 22 `color-contrast` nodes "incomplete" (feed, network, p/[slug], settings, applications/received, discover). These need a manual check.

### `list` — serious — 4 nodes / 4 scans (1.3.1)
- `/messages/[id]`: `<ol aria-live="polite" aria-label="Messages with …">` contains a `<div ref={bottom}>` scroll sentinel as a direct child (`src/app/(app)/messages/[id]/thread.tsx:68`).

### Best-practice pass (not WCAG failures; light variants)
| Rule | Scans | Where | Sample |
|---|---|---|---|
| `landmark-unique` | 10 | `/feed`, `/`, `/discover`, `/opportunities` (both auth states), `/dev/mailbox` | two unnamed `<aside>` landmarks (`.lg:block`, `.py-5`) |
| `region` | 9 | all auth pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`) | `a[aria-label="Collab Hub home"]` sits outside any landmark |
| `page-has-heading-one` | 5 | `/messages/[id]`, `/posts/[id]` (signed in and out) | no `<h1>` |
| `heading-order` | 4 | `/opportunities`, `/discover?type=projects` | card titles are `h3` directly under the page `h1` |
| `landmark-main-is-top-level`, `landmark-no-duplicate-main` | 3 each | not-found inside the app layout: `/u/does-not-exist`, `/p/<private>`, `/dev/mailbox` | `src/app/not-found.tsx` renders `<main id="main">` inside the layout's `<main id="main">` (also a duplicate `id`) |

## Keyboard findings per flow (`results/keyboard.json`)

"Focus lost" means `document.activeElement` became `<body>`. Global finding for every text field (`Input`, `Textarea`, `Select`, the TagInput wrapper, the header search box): `focus:outline-none` + `ring-2 ring-accent/20`. The ring is **1.38:1** against the background, so the only noticeable cue is a 1px border changing to accent (border 7.8:1). Buttons and links get a 2px outline at 4.5–4.9:1, which is fine. Visually hidden file inputs ("Image", "Upload") get a 40% ring at **1.97:1**.

| Flow | Result | Findings |
|---|---|---|
| Skip link → main (`/`, `/feed`) | ✅ works | First Tab stop, visible (125×39), next Tab lands in `<main>`. ⚠ After Enter, `activeElement` is `<body>` because `main#main` has no `tabindex="-1"`. Sequential navigation still works. |
| Skip link (`/login`) | ⚠ | The email field is autofocused, so the skip link is only reachable with Shift+Tab ×2. Acceptable. |
| Sign in | ✅ completes | Email autofocused → Tab → password → Tab ×2 → Enter. ⚠ After redirect to `/feed`, focus is on `<body>`. Sampled right after the redirect, the Next.js route announcer still held "Welcome back" (the login page's h1). Check the timing with a real screen reader. |
| Validation `/login` (empty) | ✅ good | Focus stays on the first invalid field, `role="alert"` summary "Please check the highlighted fields.", fields `aria-invalid` + `aria-describedby` → error text. |
| Validation `/signup`, `/forgot-password`, `/projects/new`, Apply form | ❌ focus lost | Same `role="alert"` + `aria-invalid`/`aria-describedby` (good), but the submit button is disabled while pending, so **focus drops to `<body>`** and is never moved to the summary or the first invalid field (`ActionForm`, `src/components/ui/form.tsx`). `/login` only escapes this because Enter was pressed in a field. |
| Create a post (feed composer) | ⚠ | Reachable (Tab ×17), "Posted." announced in the polite status region. ❌ After publishing, the composer collapses, the Post button unmounts, and **focus is lost**. |
| Like | ⚠ | `aria-pressed` toggles false → true. ❌ The button is `disabled={liking}` while pending, which blurs it, so **focus is lost** on every Like (`src/components/post-actions.tsx`). |
| Comment (`/posts/[id]`) | ⚠ | Comments link → Enter → client navigation leaves focus on `<body>`. Textarea → Comment → posted. ❌ Focus lost after submit. ❌ Nothing is announced (`successToast={false}`, and the list is not a live region). |
| User menu | ⚠ | Enter opens it (`aria-expanded=true`) and Escape closes it with focus back on the trigger ✅. ❌ It's `role="menu"` but focus isn't moved into it and Arrow keys do nothing (items only reachable by Tab). ❌ The menu **stays open after focus Tabs out** of it. |
| Post options menu + Report dialog | ⚠ | Menu: same `role="menu"` problems. Escape returns focus to the trigger ✅. Dialog (native `showModal`): focus moves inside ✅, Tab cycles inside (via browser chrome) ✅, Escape closes ✅. ❌ **Focus is then lost to `<body>`**, because the "Report post" menuitem that opened the dialog was unmounted, so the browser has nowhere to restore focus. |
| Share options menu | ❌ | Escape with focus on a menuitem closes the menu, but **focus is lost** instead of returning to the trigger (`ShareMenu` doesn't refocus). |
| Mobile bottom nav (360) | ⚠ | Reachable, `aria-current="page"` ✅, and the 240px user menu fits at 360 ✅. ❌ **Tab order: header (4 stops) → bottom nav (stops 5–9) → main (stop 10)**, so the visually-bottom nav comes first (2.4.3). ❌ **Focus Not Obscured (2.4.11)**: tabbing through the feed puts "Diogo Alves", "26 minutes ago" and "Post options" fully under the fixed bottom nav. Confirmed by screenshot: the focused link was at y=760–780 and the nav covers y=743–800. No `scroll-padding-bottom` is set. |
| Connection request (`/u/elena`) | ⚠ | "Connect with Elena Rossi" → Enter → "Connection request sent." announced ✅. ❌ The button is replaced, so focus is lost. Withdraw: "Request sent" → Enter arms the inline confirm (the name changes to "Withdraw request?", which is only a name change, not an announcement) → Enter → ❌ focus lost again. |
| Apply (`/opportunities/[id]`) | ⚠ | Empty submit: see validation row. Filled submit: "Application sent…" announced ✅. ❌ The form is replaced, so focus is lost. |
| Message (`/messages/[id]`) | ✅ mostly | Composer is 1 Tab away. Enter sends and focus stays in the textarea ✅. ⚠ The whole history `<ol aria-live="polite">` is the live region (no `role="log"`, no `aria-relevant`), so re-renders and polling may re-announce or over-announce. Verify with a screen reader. |

Not exercised, code-read only: the composer **@mention suggestions** (`role="listbox"`, options with only `onMouseDown`, no arrow keys, `aria-selected` always false) look **mouse-only**. TagInput suggestions and ActionButton inline confirms on other pages were not tested.

## ARIA / screen-reader proxy findings (`results/aria/`)

| Page | Landmarks (Chromium tree) | Headings | Notes |
|---|---|---|---|
| Feed | banner, search, nav "Main", main › complementary (unnamed), nav "Shortcuts", region "Create a post", nav "Feed mode", complementary (unnamed), contentinfo | h1 "Home feed", then h2 only in the sidebars; **posts have no headings** (articles are named "Post by X") | **Two unnamed `complementary`** (desktop). The left sidebar comes before the h1 in reading order. The "Get discovered 5/6" checklist shows done/undone only by strikethrough and an `aria-hidden` icon. Button names start with the count ("3 Like", "0 Share options"). |
| Profile `/u/diogo` | banner, search, nav, main, regions "Diogo Alves" / "About" / "Activity", complementary, contentinfo | h1 + h2s, no skips | Title "@diogo" (handle, not the person's name). |
| Opportunity | banner, search, nav, main, complementary (Apply), region "Why this matches you", contentinfo | h1 + h2/h3, no skips | Title is just "Opportunity", the same for every opportunity. Match score is read as "15 Low match". |
| Conversation | banner, search, nav, main, region "Conversation with Bruno Costa", contentinfo | **no headings at all** | List "Messages with Bruno Costa" is a polite live region. The textbox "Message" and the disabled "Send" button are labelled. Title "Conversation". |

All four pages: `lang="en"`. No `<img>` without `alt` (no images in the seed; avatars are initials with `aria-hidden`). Every `<svg>` is hidden. No unnamed controls found. At 360 there are no duplicate landmarks: the header search is `display:none` and replaced by a "Search" link. Every page has an empty `role="status" aria-live="polite"` toast region (good). The Next.js route announcer is present.

## Target size (2.5.8) beyond axe (`summary.json` → `smallTargetsFailing`)

576 small-target instances pass via the inline or spacing exception. Failures not covered by the exceptions:
- Entity name links (`div > a.block.truncate.text-sm`, ≈170×20) conflict with the "N minutes ago" / author meta links under them: `/feed`, `/p/[slug]`, `/posts/[id]`, `/network`, `/u/[username]`.
- At 360 on short pages (`/messages`), the **footer links** (`Terms`, `Privacy`, `Discover`, `Opportunities`, 16px tall) sit inside the spacing circle of the fixed bottom nav links.

## Titles, language, status codes, motion

- **`lang="en"`** on every page ✅.
- **Titles** (`"%s · Collab Hub"`): unique per route type, **but not per entity or state**. Every opportunity is "Opportunity", every post "Post", every conversation "Conversation". Projects and orgs use the **slug** ("studypilot", "nova-labs") instead of the name. Org and project "Partners" pages share "Partners". `/reset-password` and `/verify-email` don't change title on error. **Not-found pages keep the entity title** ("@does-not-exist", "a11y-audit-private") while the h1 says "This page isn't available".
- **HTTP status, signed out** (`status-codes.json`):

| Path | Status | Notes |
|---|---|---|
| `/u/does-not-exist` | **200** | not-found UI + `noindex` |
| `/p/a11y-audit-private` (private project) | **200** | not-found UI + `noindex`; no content leaked |
| `/p/…`, `/o/…`, `/posts/…`, `/opportunities/…`, `/tags/…` (nonexistent) | 200 | same pattern (streamed pages send headers before the lookup) |
| `/this-route-does-not-exist` | 404 | |
| `/feed`, `/settings`, `/moderation`, `/projects/studypilot/manage` | 307 → `/login?next=…` | |

- **Reduced motion**: the only `prefers-reduced-motion` rule disables `.skeleton` shimmer (`src/app/globals.css:142`). `animate-spin` loaders and 150ms `transition-colors` on 81 elements on `/feed` are unchanged under `reduce`. There is no smooth scrolling and no transform or parallax motion. Low risk; a global reduce rule would cover spinners and future animations.

## Prioritised fixes

| P | Issue | WCAG | Where | Effort |
|---|---|---|---|---|
| **P0** | Notifications are announced only as "Open": drop the `aria-label` (or include the text) and put "(unread)" in visually hidden text | 4.1.2, 2.5.3 | `notifications/notification-link.tsx` | S |
| **P0** | Focus lost after invalid submit: in `ActionForm`, focus the `role="alert"` summary (or first `aria-invalid` field) when `fieldErrors` arrive; don't let a disabled submit button swallow focus | 3.3.1, 2.4.3 | `components/ui/form.tsx` (affects all forms) | M |
| **P0** | Focus lost after in-place actions: Like (`disabled={liking}`), composer collapse, comment submit, Connect/Withdraw/Apply replacing their buttons. Keep the control focusable (`aria-disabled` instead of `disabled`) or move focus deliberately (to the new state's control, the new post or comment, or a heading) | 2.4.3 | `post-actions.tsx`, `composer.tsx`, `ui/action-button.tsx`, `relationship-actions.tsx`, `posts/[id]/comments.tsx`, `opportunities/[id]/apply-form.tsx` | M |
| **P0** | Bottom nav hides focused content at 360: add `scroll-padding-bottom` (≈ nav height + safe area) on `html` for `< md`; same at the top for the sticky header | 2.4.11 | `globals.css`, `shell/app-shell.tsx` | S |
| **P1** | Inline links need a non-colour cue: underline `.link` and hashtags/mentions in post text | 1.4.1 | `globals.css .link`, `rich-text.tsx` | S |
| **P1** | Dark-mode contrast: unread badge (white on `#f08a5d`, 2.47:1) and own-message timestamps | 1.4.3 | `shell/nav-link.tsx`, dark tokens, `thread.tsx` | S |
| **P1** | Menus: either use the disclosure pattern (drop `role="menu"`/`menuitem`) or implement menu keyboarding (focus first item, arrows, Home/End). Close on focus-out. Return focus to the trigger on Escape/selection (Share menu), and restore focus to "Post options" when the Report dialog closes | 4.1.2, 2.4.3, 2.1.1 | `shell/user-menu.tsx`, `post-actions.tsx` (ShareMenu, PostMenu), `report-dialog.tsx` | M |
| **P1** | Mobile tab order: render `MobileNav` after `<main>`/footer in the DOM (it's fixed, so it looks the same) | 2.4.3 | `shell/app-shell.tsx`, `(app)/layout.tsx` | S |
| **P1** | Target size: filter checkboxes 14px → at least 24px hit area (pad the label row to 24px min); entity name links `block` 20px → min-h 24 or more gap above the meta row | 2.5.8 | `components/filters.tsx`, card/post headers in `post-card.tsx`, `entity-cards.tsx`, `sidebar.tsx` | S |
| **P1** | Composer @mention suggestions not keyboard operable (code read): add combobox semantics (`aria-activedescendant`, arrows, Enter) | 2.1.1, 4.1.2 | `components/composer.tsx` | M |
| **P2** | Text field focus ring too faint (ring 20% alpha, 1.38:1): use a solid 2px ring/outline at ≥3:1 (as for buttons) | 2.4.7 (2.4.13 AAA) | `components/ui/form.tsx` `control`, `tag-input.tsx`, `app-shell.tsx` search | S |
| **P2** | Messages: move the sentinel `<div>` out of the `<ol>`; use `role="log"` + `aria-relevant="additions"` on a container that receives only new messages, instead of a live region on the whole history | 1.3.1, 4.1.3 | `messages/[id]/thread.tsx` | S |
| **P2** | Announce comment success and other silent successes (`successToast={false}`) via the status region | 4.1.3 | `posts/[id]/comments.tsx` | S |
| **P2** | Page titles: entity names in titles (opportunity title, post author/excerpt, conversation partner, project/org **name**), state in titles (error/404), and the not-found title on not-found pages | 2.4.2 | `generateMetadata` in dynamic routes | M |
| **P2** | Headings/landmarks: `<h1>` on `/messages/[id]` and `/posts/[id]`; card titles h3→h2 on listing pages; name the two feed `<aside>`s; wrap the auth layout logo in a header landmark; `not-found.tsx` must not render a second `<main id="main">` inside the app layout | 1.3.1, 2.4.6 (best practice) | listed routes, `app/not-found.tsx`, `(auth)/layout.tsx`, `sidebar.tsx` | S–M |
| **P2** | Skip-link target: `tabindex="-1"` on `main#main` so activation actually moves focus (helps SR users and older browsers) | 2.4.1 | 4 layouts + `not-found.tsx` | S |
| **P3** | After client-side navigation and sign-in, focus stays on `<body>` or the clicked link, and right after sign-in the route announcer still held the login h1. Consider focusing the new page's h1 on route change | 2.4.3 | `(app)/layout.tsx` | M |
| **P3** | Soft-404s return HTTP 200 (+`noindex`). Return 404 where the lookup can run before streaming (or accept and document it). Not an a11y failure in itself | — | dynamic routes | L |
| **P3** | Profile checklist: expose done state ("completed") in text, not just strikethrough + hidden icon. Put the name before the count in action buttons ("Like, 3") | 1.3.1 | `sidebar.tsx`, `post-actions.tsx` | S |
| **P3** | Reduced motion: global `@media (prefers-reduced-motion: reduce)` that neutralises `animate-spin` and transitions | 2.3.3 (AAA) | `globals.css` | S |

## Not covered / limitations

- **No real screen reader** (VoiceOver/NVDA/TalkBack) and no speech output. Live-region behaviour, route-announcer timing and reading order still need a manual pass.
- Chromium only (no Safari/WebKit or Firefox). No forced-colors / Windows High Contrast. No 200%/400% zoom or text-spacing test (360px width only roughly stands in for reflow). No touch or screen-reader gestures.
- Keyboard flows covered only the listed scenarios. The image upload, gallery, team, partner, moderation and settings forms were scanned by axe but not walked by keyboard. Mention autocomplete and TagInput suggestions were reviewed in code only.
- Focus-indicator contrast is measured against the nearest opaque ancestor background, as a proxy for 1.4.11/2.4.13. "Focus obscured" uses `elementFromPoint` sampling and ignores sr-only controls.
- The axe "incomplete" items (92 nodes) were not resolved manually.
- The seed has no images, so `image-alt` and avatar `alt` text were never exercised with real uploads.
- Results reflect the seed data and ana's account state (16+ unread notifications drive the dark badge findings).

## Artefacts

- `docs/audit/a11y/playwright.a11y.config.ts`: standalone config (no `webServer`, baseURL `http://localhost:3200`; override with `A11Y_BASE_URL`, `A11Y_DATABASE_URL`)
- `docs/audit/a11y/a11y-auth.setup.ts`, `a11y-sweep.spec.ts`, `a11y-aria.spec.ts`, `a11y-keyboard.spec.ts`, `a11y-lib.ts`
- `docs/audit/a11y/summarize.mjs` → `results/summary.json`
- `docs/audit/a11y/cleanup.sql`: removes audit-created data
- `docs/audit/a11y/results/`: `sweep/*.json` (raw per-scan axe results incl. best-practice and small-target data), `keyboard.json`, `aria/*.yml|json`, `status-codes.json`, `reduced-motion.json`, `fixtures.json`, `summary.json`
