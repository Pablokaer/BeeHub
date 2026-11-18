# Threat model (STRIDE): auth, messaging, uploads, moderation

Status: M0 baseline, 2026-11-11. Based on a read of the code as it is today, not on intended design. Finding IDs (`SEC-…`, `PERF-…`, …) refer to [docs/AUDIT.md](../AUDIT.md). Ratings: **H** high, **M** medium, **L** low (likelihood × impact, before mitigations planned in M1+).

## 1. System context

```
                      ┌──────────────────────── trust boundary: internet ────────────────────────┐
 Browser (visitor /   │  Reverse proxy / LB (not in repo; X-Forwarded-* added here)              │
 member / staff) ─────┼─► Next.js server (pages, server actions, route handlers, proxy.ts)        │
 SMTP provider ◄──────┼── src/server/mail (sync send inside the request)                           │
 Cron caller ─────────┼─► POST /api/cron/notification-emails (Bearer CRON_SECRET)                  │
                      │        │                                                                   │
                      │        ├─► PostgreSQL 16 (all state, incl. rate limits, outbox, audit)     │
                      │        └─► Local disk UPLOAD_DIR (processed images, served by /api/media)  │
                      └──────────────────────────────────────────────────────────────────────────┘
```

Trust boundaries:
1. Browser → server: all input untrusted. Authentication is a session cookie `ch_session` (random 256-bit token, SHA-256 stored).
2. Proxy → server: `X-Forwarded-For`, `X-Forwarded-Host` are trusted unconditionally today (no notion of trusted proxies).
3. Server → Postgres: one superuser-equivalent role for app, migrations and tests (no least privilege, no statement timeout).
4. Server → disk: uploads written to a local path; any process with the key can read them through `/api/media`.
5. Staff boundary: `role IN (MODERATOR, ADMIN)` unlocks `/moderation` (reports, removal, suspension, audit log). Single-factor password only.

## 2. Assets

| Asset | Where | Why it matters |
| --- | --- | --- |
| Credentials (password hashes) | `User.passwordHash` | Account takeover, credential stuffing elsewhere |
| Session tokens | cookie; `Session.tokenHash` | Full account access for 30 days (fixed expiry) |
| Verification / reset tokens | `AuthToken.tokenHash` (hashed) **and `EmailOutbox.text` (plaintext link)** | Password reset = account takeover |
| Private messages | `Message.body` | Confidentiality between members |
| Private project data (team, updates, opportunities, gallery images) | `Project` (PRIVATE), `ProjectImage`, media files | Confidential work |
| Profile privacy settings (members-only, hidden location, not searchable) | `Profile` | Users rely on them for safety |
| Applications (messages, notes, status history) | `Application`, `ApplicationEvent` | Personal, sometimes sensitive career data |
| Moderation decisions and audit trail | `Report`, `AuditLog` | Accountability, legal evidence |
| Availability | whole app | Feed/search/publish paths do unbounded work |

## 3. Authentication and sessions

| STRIDE | Threat | Current control | Gap | Rating | Ref |
| --- | --- | --- | --- | --- | --- |
| **S**poofing | Online password guessing against one account | `login` limit 10 / 15 min keyed by `email|ip` | `ip` comes from client-supplied `X-Forwarded-For` (`src/server/auth/viewer.ts:50`); rotating the header gives unlimited attempts. No per-account limit, no backoff, no user alert. Unknown-email attempts aren't audited. | **H** | SEC-01 |
| S | Credential stuffing across many accounts | none beyond the same per `email|ip` key | No global/IP-reputation limit, no bot protection on login/signup, no breached-password check | **H** | SEC-01, SEC-12 |
| S | Password reset token theft | Token hashed in `AuthToken`, 1 h TTL, single use | Full reset link stored in plaintext in `EmailOutbox.text` forever; anyone with DB/backup/log read gets live tokens. `/dev/mailbox` shows them to **unauthenticated** visitors on any non-production deployment (`src/app/(app)/dev/mailbox/page.tsx`) | **H** | SEC-02, SEC-14 |
| S | Staff account takeover | scrypt, password only | No 2FA (required for staff by the target); staff sessions live 30 days | **H** | SEC-09 |
| S | Session fixation | New random token on every login | Previous session cookie not invalidated on login; sessions not rotated on privilege change (role change, ownership transfer) | L | SEC-10 |
| S | Email change takeover | Current password required | Email changes immediately (no confirmation link to the *new* address, no notice to the *old* one, other sessions kept); an attacker with a stolen session + password can silently move the account | M | SEC-11 |
| **T**ampering | CSRF on actions | Server Actions Origin check; `assertSameOrigin` for `/api/uploads`; SameSite=Lax | `assertSameOrigin` compares to `X-Forwarded-Host` when present (trusts header); state-changing GET in `/api/messages/[id]` (marks read) — low impact | L | SEC-15 |
| T | Open redirect after login | `safeNext` requires leading `/`, rejects `//` and `/\` | Control characters (`/\t/evil.example`) not rejected; browsers strip tab/newline when parsing — unverified whether Next encodes them | L | SEC-16 |
| **R**epudiation | Denying a login/password change | `AuditLog` for login, failure (known users only), password/email change, deletion | No request id, user agent not recorded in audit; failed logins for unknown emails not recorded; audit log rows deletable by the app role | M | OPS-03 |
| **I**nformation disclosure | Account enumeration via signup | Login and reset are uniform | Signup returns "An account with this email already exists" (`service.ts` signup) — enumeration (common trade-off; rate-limited only by spoofable IP) | M | SEC-13 |
| I | Timing on login | Dummy scrypt for unknown emails | OK | L | — |
| I | Logs leak PII | JSON logs; audit entries logged with IP | Errors logged with full message/stack (Prisma errors can include values); no scrubbing | M | OPS-04 |
| **D**enial of service | scrypt CPU exhaustion | N=2¹⁵ r=8 p=3 (~100 ms each) | Login limit bypassable (SEC-01) → attackers can burn CPU with unlimited scrypt computations; signup also hashes before any bot check | **H** | SEC-01 |
| D | Rate-limit table growth | — | `RateLimit` rows never deleted; header rotation creates one row per spoofed IP | M | DATA-03 |
| **E**levation of privilege | Reactivating a deactivated account | Login reactivates | By design; but a suspended account's `DEACTIVATED → ACTIVE` path is OK (suspended is checked first) | L | — |
| E | Deleted user's handle re-registered by someone else | Handle released on deletion | Old @mentions of the deleted user now resolve to the new owner if mentions are re-resolved by handle — mentions store `userId`, so OK for existing ones | L | — |

## 4. Messaging

| STRIDE | Threat | Current control | Gap | Rating | Ref |
| --- | --- | --- | --- | --- | --- |
| S | Messaging someone who restricted messages | `canMessage` (connections / teammates / application relation) | Rule is evaluated only when the conversation is created; existing conversations stay open after a user tightens the setting (documented) | L | — |
| T | Message forgery / edit | Messages immutable, sender from session | OK | — | — |
| R | Harassment then deletion | Reports on messages; moderator removal hard-deletes the message | Removal deletes the evidence (no tombstone/retention for legal hold) | M | MOD-02 |
| I | Reading other people's conversations (IDOR) | `participantOrThrow` on every read/poll | OK (not-found for non-participants) | — | — |
| I | Moderators reading whole conversations | Report preview shows only the reported message | OK today; keep this when M7 adds context | L | — |
| I | Unread/notification text leaks message content | Notification text includes first 80 chars; email digests include notification text | Message content goes to email when the user opts in; fine if disclosed in privacy page | L | PRIV-04 |
| D | Polling load | 4 s polling per open conversation; each poll = participant lookup + messages query (+ 2 updates when unread) | At 10k concurrent open conversations ≈ 2.5k req/s of DB work; no SSE yet; `after` timestamp cursor can skip messages with identical timestamps | M | PERF-08 |
| D | Spam via new conversations | 20 new conversations/day per user, 120 messages/h | No new-account restrictions, no link limits | M | TS-01 |
| E | Blocked user still messages | `isBlockedEitherWay` on send and start | OK | — | — |

## 5. Uploads and media

| STRIDE | Threat | Current control | Gap | Rating | Ref |
| --- | --- | --- | --- | --- | --- |
| S | Using someone else's upload in my content | `assertOwnedMedia` | OK | — | — |
| T | Malicious file (polyglot, SVG script, EXIF GPS) | Decode with sharp, allowlist formats, re-encode to WebP, strip metadata, `nosniff`, `default-src 'none'` on media responses | OK | — | — |
| I | Private project gallery/team images readable by anyone with the URL | Unguessable 144-bit keys | No authorization on `/api/media/*`; `Cache-Control: public, immutable, 1 year` — copies persist in shared caches/CDNs even after the project goes private or the user is deleted | **H** | SEC-03 |
| I | Deleted account's photos remain | — | `deleteAccount` doesn't delete `MediaAsset` rows or files; removed posts' images keep being served | M | PRIV-02 |
| D | Memory exhaustion via large multipart bodies | `UPLOAD_MAX_MB` check after `req.formData()` | Route handler reads the whole body before the size check (no Content-Length guard) → large concurrent uploads exhaust memory; sharp `limitInputPixels` 40 MP is good | M | SEC-17 |
| D | Disk exhaustion | 60 uploads/h per user | No per-user quota, no orphan cleanup (uploads never attached are kept forever), unverified accounts may upload | M | DATA-04 |
| E | Path traversal | Strict key regex + prefix check | OK | — | — |

## 6. Moderation

| STRIDE | Threat | Current control | Gap | Rating | Ref |
| --- | --- | --- | --- | --- | --- |
| S | Attacker gains staff session | Password only | No 2FA / step-up for moderation actions | **H** | SEC-09 |
| T | Moderator abuses power (removes content, suspends users) | Moderators can't suspend admins; only admins suspend moderators; every decision audited | No four-eyes for suspensions, no appeal flow, no notice to the affected author, moderators can resolve reports about themselves | M | MOD-01 |
| R | Disputed moderation decision | `AuditLog` row with note | Audit rows are mutable by the app DB role; no retention policy; message removal destroys evidence | M | MOD-02 |
| I | Moderators see more than necessary | Report preview limited to target | Audit log page shows every user's IP to moderators (`listAuditLog` includes `ip`) | L | PRIV-05 |
| I | Report as existence oracle | `targetExists` | Reporting any id confirms existence of private projects/opportunities (cuid ids make this low value) | L | — |
| D | Report flooding | 20 reports/h per user | No dedupe across reporters beyond one open report per reporter/target; queue `take: 100` with N+1 previews | L | PERF-10 |
| E | Non-staff reaching moderation | `assertStaff` in every service function | OK; `/moderation` also guarded by proxy redirect (optimistic) | — | — |

## 7. Cross-cutting

| Threat | Gap | Rating | Ref |
| --- | --- | --- | --- |
| XSS | User content is never rendered as HTML (good), but CSP allows `'unsafe-inline'` scripts, so any future HTML injection is directly exploitable | M | SEC-05 |
| Header trust | `X-Forwarded-For` / `X-Forwarded-Host` trusted without a trusted-proxy list | **H** | SEC-01 |
| Secrets at rest | Reset/verification links in `EmailOutbox`; `docker-compose.yml` ships `CRON_SECRET: change-me` and a placeholder action key | M | SEC-02, OPS-06 |
| Database blast radius | App uses one role with DDL rights; no `statement_timeout`; no pool sizing | M | REL-03 |
| Supply chain | No dependency/secret scanning or SBOM in CI; npm 11 install-script approvals not configured (Prisma engines/esbuild postinstall skipped locally) | M | OPS-05 |

## 8. Out of scope for this pass

OAuth (not wired), payments (none), infrastructure (no IaC yet), legal text review.
