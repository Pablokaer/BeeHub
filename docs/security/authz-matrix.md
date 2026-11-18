# Authorization matrix (M0 baseline audit)

Status: baseline audit of the code as of 2026-11-11. No product code was changed. Every cell below was derived by reading the code; the "Enforced at" column cites `path:line (function)`. Anything not verified by reading is marked **unverified**.

Companion document: `docs/security/threat-model.md` (STRIDE for auth, messaging, uploads, moderation).

## 0. How to read this document

### Cell codes

| Code | Meaning |
| --- | --- |
| `A` | Allowed |
| `A*` | Allowed, but flagged as a discrepancy (see the finding referenced in the row) |
| `D` | Denied with an error (403 `FORBIDDEN`, 422 `VALIDATION` or 409 `CONFLICT`) |
| `N` | Not found: service throws `NotFoundError` / returns `null`, or the item is filtered out of a list. Pages turn both `NOT_FOUND` and `FORBIDDEN` into the 404 page via `src/server/page-utils.ts:9 (orNotFound)` |
| `401` | Unauthenticated (`requireViewer` throws, `src/server/auth/viewer.ts:30`), or redirect to `/login` on pages (`viewer.ts:23 requireViewerPage`, plus the optimistic cookie check in `src/proxy.ts:8-34`) |
| `V` | Denied because the email is not verified (`EMAIL_NOT_VERIFIED`, `src/server/auth/viewer.ts:37-45`) |
| `R` | Restricted stub (members-only profile seen by a visitor) |
| `UI` | The rule exists only in the UI (a hidden button/link); the server allows more |
| `NE` | Not enforced anywhere |
| `—` | Not applicable |

Row IDs (`PRJ-07`, `POST-10`, …) are stable and are referenced by the test-coverage section and by the planned table-driven suite.

### Subjects

| Subject | Definition and how the code resolves it |
| --- | --- |
| `ANON` | No session cookie, or a session that resolves to no viewer. **Suspended, deactivated and deleted accounts are always `ANON`**: `viewerFromSessionToken` returns `null` unless `status === "ACTIVE"` (`src/server/auth/service.ts:109`), and their sessions are also deleted (`moderation.ts:139`, `service.ts:262-265`, `service.ts:315`). |
| `UNV` | Signed in, `emailVerifiedAt` null. Only differs from `MBR` where an action calls `requireVerifiedViewer` (default `REQUIRE_EMAIL_VERIFICATION=true`, `src/server/env.ts:13`). |
| `MBR` | Signed in, verified, no relation to the resource. |
| `SELF` | The user the resource belongs to (own profile, own application, own post…). |
| `BLK` | A `Block` row exists in **either** direction between the viewer and the relevant user (`src/server/authz.ts:148 isBlockedEitherWay`, `authz.ts:156 blockedUserIds`). Staff cannot be blocked (`src/server/social/graph.ts:284`). |
| `P-OWN/P-ADM/P-EDT/P-MEM` | Effective project role from `src/server/authz.ts:51-69 (getProjectRole)` = max(direct `ProjectMember.role`, delegated role). |
| `OD-ADM` / `OD-EDT` | Delegated project role from the owning org: org OWNER/ADMIN → project ADMIN, org EDITOR → project EDITOR (`authz.ts:63-67`). Delegation is **capped at ADMIN**; an org OWNER never has project OWNER rank. Wherever a matrix says `P-ADM` it includes `OD-ADM`; `P-EDT` includes `OD-EDT`. |
| `O-MEM` (on projects) | Member of the owning org with role MEMBER: no delegated project role at all. |
| `O-OWN/O-ADM/O-EDT/O-MEM` | `OrganizationMember.role` (`authz.ts:44 getOrgRole`). No delegation from projects to orgs. |
| `MGR` | Opportunity manager: `canManageOpportunity` (`src/server/opportunities.ts:43-48`) = project EDITOR+ (effective, incl. delegated) for project-owned, org EDITOR+ for org-owned, `createdById` for personal opportunities. Uses the project's **current** organization. |
| `APPL` | The applicant (`Application.applicantId`). |
| `PART` | Conversation participant (`ConversationParticipant`). |
| `MOD` / `ADM` / `STAFF` | Site roles `MODERATOR` / `ADMIN`; `STAFF` = either (`src/server/auth/types.ts:22 isStaff`). |

### Enforcement primitives (referenced throughout)

| Primitive | Location | Behaviour |
| --- | --- | --- |
| Session → viewer | `src/server/auth/service.ts:92-125 (viewerFromSessionToken)` | Expired or non-ACTIVE user → `null`. |
| `requireViewer` / `requireVerifiedViewer` | `src/server/auth/viewer.ts:30`, `:37` | Every server action starts with one of these (see per-row citations of `src/app/actions/*.ts`). |
| `assertProjectPermission` | `src/server/authz.ts:71-84` | REMOVED → N. `view`: PUBLIC or any role or staff. Others: rank check; non-member of PRIVATE → N, else D. Does **not** reject ARCHIVED. |
| `assertOrgPermission` | `src/server/authz.ts:86-93` | REMOVED → N; rank check → D. Does **not** reject ARCHIVED. |
| `canManageMember` | `src/server/authz.ts:96-103` | OWNER: anything. ADMIN: only targets below ADMIN and new role below ADMIN. |
| `resolveActingAs` | `src/server/authz.ts:111-127` | `org:<id>` needs org ACTIVE + EDITOR+; `project:<id>` needs project ACTIVE (any visibility) + EDITOR+. |
| `notify` | `src/server/notifications.ts:23-43` | Skips self, non-ACTIVE recipients, blocked actor↔recipient, disabled preferences. Central block filter for all notifications. |
| `visiblePostWhere` | `src/server/posts.ts:55-65` | PUBLISHED, author ACTIVE, project ACTIVE+PUBLIC (if any), org ACTIVE (if any), author not in viewer's block list. |
| `publicOpportunityWhere` | `src/server/opportunity-visibility.ts:8-18` | OPEN, deadline not passed, project ACTIVE+PUBLIC, org ACTIVE, **creator ACTIVE** (all owner kinds). |
| `orNotFound` | `src/server/page-utils.ts:9-15` | Manage pages: NOT_FOUND/FORBIDDEN → 404. |
| Proxy | `src/proxy.ts:8-34` | Cookie-presence redirect only; real checks are server-side. `/dev/*`, `/u/*`, `/p/*`, `/o/*`, `/posts/*`, `/tags/*`, `/opportunities/<id>`, `/discover` are not in the list (public by design, except `/dev`, see F-04). |

---

## 1. Account, sessions and GDPR (`AUTH`)

### 1a. By account status (target = the account itself)

| ID | Action | ACTIVE | DEACTIVATED | SUSPENDED | DELETED | Enforced at |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Sign in with correct password | A | A (reactivates) | D (403 after password check) | D (generic "incorrect") | `src/server/auth/service.ts:56` (DELETED), `:65` (SUSPENDED), `:66-69` (DEACTIVATED) `authenticate` |
| AUTH-02 | Existing session resolves to a viewer | A | N | N | N | `service.ts:109 (viewerFromSessionToken)`; sessions also deleted at `service.ts:262-265`, `moderation.ts:139`, `service.ts:315` |
| AUTH-03 | Request password-reset email | A | A | N (silently ignored) | N (silently ignored) | `service.ts:190 (requestPasswordReset)` |
| AUTH-04 | Reset password with a valid unexpired token | A | A | A (password set; new session is useless per AUTH-02) | — (tokens deleted at `service.ts:316`) | `service.ts:203-218 (resetPassword)` (no status check) |
| AUTH-05 | Receive notification e-mail digest | A (if verified) | N | N | N | `src/server/notification-email.ts:29` |

### 1b. Self-service account actions

| ID | Action | ANON | UNV | MBR (on self) | Other user's resource | Enforced at |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-10 | Change password (needs current password) | 401 | A | A | — (always `actor.id`) | `src/app/actions/settings.ts:86`; `service.ts:233-242 (changePassword)` |
| AUTH-11 | Change email (needs current password; clears verification) | 401 | A | A | — | `settings.ts:95`; `service.ts:244-256 (changeEmail)` |
| AUTH-12 | List sessions | 401 | A | A (own only) | N | `service.ts:131-137 (listSessions)` scoped by `userId` |
| AUTH-13 | Revoke a session by id | 401 | A | A | N (no-op: `deleteMany` scoped to `userId`) | `settings.ts:105`; `service.ts:139-142 (revokeSession)` |
| AUTH-14 | Revoke all other sessions | 401 | A | A | — | `settings.ts:114`; `service.ts:144-148` |
| AUTH-15 | Deactivate account (password) | 401 | A | A | — | `settings.ts:132`; `service.ts:260-267` |
| AUTH-16 | Delete account (password + "DELETE") | 401 | A | A | — | `settings.ts:143-146`; `service.ts:274-333 (deleteAccount)`; see F-12, F-13 |
| AUTH-17 | Export account data (`GET /api/me/export`) | 401 | A | A (own only) | — | `src/app/api/me/export/route.ts:10`; `service.ts:336-361` |
| AUTH-18 | Resend verification email | 401 | A | A (no-op) | — | `src/app/actions/auth.ts:70-72`; `service.ts:166` |
| AUTH-19 | Verify email (token bearer) | A | A | A | — | `service.ts:171-182` (token only, no session needed) |
| AUTH-20 | Edit own profile / privacy / experience / education | 401 | A | A | N (`updateMany`/`deleteMany` scoped to `userId`) | `settings.ts:18-67`; `src/server/profiles.ts:122,151,169,179,192,202` |
| AUTH-21 | Notification preferences | 401 | A | A | — | `settings.ts:73`; `src/server/notifications.ts:81` |
| AUTH-22 | Reuse a freed username (after deletion of its owner) | A* (at sign-up) | — | — | — | `service.ts:320` frees `Handle`; `src/server/handles.ts:7-14`; see F-12 |

---

## 2. User / Profile (`PROF`)

Target is user T. Columns are the viewer.

| ID | Action / data | ANON | MBR | SELF | BLK (T↔viewer) | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PROF-01 | View profile, T ACTIVE, visibility PUBLIC | A | A | A | N | A (no special access) | `src/server/profiles.ts:29-30 (getPublicProfile)`; page `src/app/(app)/u/[username]/page.tsx:30` |
| PROF-02 | View profile, visibility MEMBERS | R (name + avatar only) | A | A | N | A | `profiles.ts:33` |
| PROF-03 | View profile, T DEACTIVATED / SUSPENDED / DELETED | N | N | — | N | N | `profiles.ts:29` |
| PROF-04 | See T's location when `showLocation=false` | N | N | A | N | N | `profiles.ts:73` (profile page); search filter `src/server/search.ts:92`; cards render only if `showLocation` (`src/components/entity-cards.tsx:32`). **Leak via matching reasons: F-10** |
| PROF-05 | Connections list, `connectionsVisible=EVERYONE` | A | A | A | N | A | `profiles.ts:37`; `src/app/(app)/u/[username]/connections/page.tsx:17,32-36` |
| PROF-06 | Connections list, `CONNECTIONS` | N | N (A if connected) | A | N | N | `profiles.ts:37` |
| PROF-07 | Connections list, `ONLY_ME` | N | N | A | N | N | `profiles.ts:37` |
| PROF-08 | Followers / following lists (any `connectionsVisible`) | A* | A* | A | N | A | `connections/page.tsx:38-39,56-71` (no audience gate) — F-11 |
| PROF-09 | Projects listed on profile | PUBLIC+ACTIVE only | PUBLIC+ACTIVE only | incl. PRIVATE | N | PUBLIC only | `profiles.ts:40-44` |
| PROF-10 | Appear in people search | if `searchable` and PUBLIC | if `searchable` | if `searchable` | N | if `searchable` | `src/server/search.ts:74-78 (searchPeople)` |
| PROF-11 | Appear in `/api/mentions` autocomplete | 401 | A (incl. `searchable=false`) | A | A* (NE) | A | `src/app/api/mentions/route.ts:9,12-30` — F-09 |
| PROF-12 | Appear in "Suggested people" on an opportunity (shown to MGR) | — | if `searchable` and PUBLIC and not UNAVAILABLE | — | A* (NE) | — | `src/server/matching.ts:120-135 (recommendCandidates)`; page passes no exclusions `src/app/(app)/opportunities/[id]/page.tsx:225` — F-09, F-10 |
| PROF-13 | Appear in "People you may know" | — | if `searchable` | — | N | — | `matching.ts:172,207 (suggestPeople)` |
| PROF-14 | MEMBERS-only user's card (name, headline, avatar, availability, location if shown) in post cards, comments, likers, project/org member lists, other people's connection/follower lists, personal-opportunity cards | A* | A | A | mostly A* (see §20) | A | `posts.ts:33`, `posts.ts:251`, `posts.ts:390-396`, `projects.ts:107`, `organizations.ts:99`, `graph.ts:127-139,255-276`, `selects.ts:61` — F-03 |

---

## 3. Organization (`ORG`)

| ID | Action | ANON | MBR | O-MEM | O-EDT | O-ADM | O-OWN | STAFF (no role) | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-01 | Create organization | 401 | A (UNV: V) | A | A | A | A | A | `src/app/actions/teams.ts:23 (requireVerifiedViewer)`; `src/server/organizations.ts:17` |
| ORG-02 | View ACTIVE org page | A | A | A | A | A | A | A | `organizations.ts:104-106 (getOrganizationPage)` |
| ORG-03 | View ARCHIVED org page | N | N | A | A | A | A | A | `organizations.ts:106` |
| ORG-04 | View REMOVED org page | N | N | N | N | N | N | N | `organizations.ts:104` |
| ORG-05 | See the org's PRIVATE projects (name, summary, slug) on the org page | N | N | A* | A | A | A | N | `organizations.ts:110`; `src/app/(app)/o/[slug]/page.tsx:116` — F-08 |
| ORG-06 | Open `/orgs/:slug/manage/*` | 401 | N | N | A | A | A | N | `organizations.ts:164-166 (getOrganizationForManage)`; pages `src/app/(app)/orgs/[slug]/manage/*/page.tsx` via `orNotFound` |
| ORG-07 | Edit details / tags / logo | 401 | D | D | A | A | A | D | `teams.ts:32`; `organizations.ts:52` (`edit`) |
| ORG-08 | Change slug (handle) | 401 | D | D | D | D | A | D | `organizations.ts:54-56` (`owner`) |
| ORG-09 | Invite member as MEMBER / EDITOR | 401 | D | D | D | A | A | D | `teams.ts:84 (verified)`; `src/server/invitations.ts:48-49 (assertGrantable)` |
| ORG-10 | Invite member as ADMIN | 401 | D | D | D | D | A | D | `invitations.ts:23` |
| ORG-11 | Invite as OWNER | 401 | D | D | D | D | D | D | `src/lib/validation.ts:242`; `invitations.ts:22` |
| ORG-12 | Change role of an EDITOR/MEMBER to EDITOR/MEMBER | 401 | D | D | D | A | A | D | `teams.ts:43`; `organizations.ts:171-176 (updateOrgMemberRole)` |
| ORG-13 | Change role of an ADMIN, or grant ADMIN | 401 | D | D | D | D | A | D | `authz.ts:100-101 (canManageMember)` |
| ORG-14 | Grant OWNER via role change / change own role | 401 | D | D | D | D | D | D | `organizations.ts:174-175` |
| ORG-15 | Remove another member (below own rank) | 401 | D | D | D | A (EDITOR/MEMBER) | A | D | `organizations.ts:186-188 (removeOrgMember)` |
| ORG-16 | Leave (self-remove) | 401 | N | A | A | A | D (transfer first) | — | `organizations.ts:184-185` |
| ORG-17 | Transfer ownership to an existing member | 401 | D | D | D | D | A | D | `organizations.ts:195-197` |
| ORG-18 | Archive / restore | 401 | D | D | D | D | A | D | `organizations.ts:206`; archiving closes org-owned OPEN opportunities `:208-210` |
| ORG-19 | Cancel a pending org invitation | 401 | D | D | D | A | A | D | `invitations.ts:108 (cancelInvitation)` |
| ORG-20 | Publish post / opportunity as the org | 401 | D | D | A | A | A | D | `authz.ts:114-118 (resolveActingAs)`; org must be ACTIVE |
| ORG-21 | Apply to an opportunity on behalf of the org | 401 | D | D | A | A | A | D | `src/server/applications.ts:41`; ARCHIVED org not rejected (F-24) |
| ORG-22 | Create a project owned by the org | 401 | D | D | A | A | A | D | `src/server/projects.ts:38`; ARCHIVED org not rejected (F-24) |
| ORG-23 | Move an existing project into the org (actor must be project OWNER) | 401 | D | D | A* | A | A | D | `projects.ts:72-75` — F-01 |
| ORG-24 | Follow org | 401 | A (ACTIVE org) | A | A | A | A | A | `src/server/social/graph.ts:193-195` |
| ORG-25 | Request / respond / cancel / end partnership for the org | 401 | D | D | D | A | A | D | `src/server/partnerships.ts:15-18 (assertCanManage)` |
| ORG-26 | Delete posts/comments on posts published as the org | 401 | D | D | D | A | A | D | `src/server/posts.ts:219 (canModeratePost)` |

---

## 4. Project (`PRJ`)

`P-ADM` includes `OD-ADM` (org OWNER/ADMIN), `P-EDT` includes `OD-EDT` (org EDITOR). `O-MEM` = MEMBER of the owning org without a direct project role.

| ID | Action | ANON | MBR | O-MEM | P-MEM | P-EDT | P-ADM | P-OWN | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRJ-01 | View PUBLIC ACTIVE project page | A | A | A | A | A | A | A | A | `src/server/projects.ts:112-116 (getProjectPage)` |
| PRJ-02 | View PRIVATE project page | N | N | N | A | A | A | A | A | `projects.ts:113-115` |
| PRJ-03 | View ARCHIVED project page | N | N | N | A | A | A | A | A | `projects.ts:116` |
| PRJ-04 | View REMOVED project page | N | N | N | N | N | N | N | N | `projects.ts:112` |
| PRJ-05 | See DRAFT/CLOSED/FILLED opportunities on project page | N | N | N | A | A | A | A | N (OPEN only) | `projects.ts:120` |
| PRJ-06 | Open `/projects/:slug/manage/*` | 401 | N | N | N | A | A | A | N | `projects.ts:162-163 (getProjectForManage)` + `orNotFound` |
| PRJ-07 | Edit details, tags, logo/cover (PUBLIC project) | 401 | D | D | D | A | A | A | D | `src/app/actions/teams.ts:104`; `projects.ts:65` (`edit`) |
| PRJ-08 | Same on a PRIVATE project | 401 | N | N | D | A | A | A | N | `src/server/authz.ts:80` |
| PRJ-09 | Change visibility PUBLIC↔PRIVATE | 401 | D | D | D | A* | A | A | D | `projects.ts:65` + `projectData` `:27` — F-21; switching to PRIVATE leaves opportunities OPEN (F-07) |
| PRJ-10 | Change slug (handle) | 401 | D | D | D | D | D | A | D | `projects.ts:68-70` (`owner`) |
| PRJ-11 | Move project into org X (needs EDITOR+ in X) | 401 | D | D | D | D | D | A* | D | `projects.ts:72-75` — F-01 |
| PRJ-12 | Detach project from its org | 401 | D | D | D | D | D (incl. org OWNER) | A* | D | `projects.ts:72-73` (only project `owner`) — F-01 |
| PRJ-13 | Add / remove gallery image (own uploads only) | 401 | D | D | D | A | A | A | D | `teams.ts:114,125`; `projects.ts:186-187,194-195`; `src/server/uploads.ts:74-83` |
| PRJ-14 | Invite as MEMBER / EDITOR | 401 | D | D | D | D | A | A | D | `teams.ts:178 (verified)`; `invitations.ts:27-28` |
| PRJ-15 | Invite as ADMIN | 401 | D | D | D | D | D | A | D | `invitations.ts:23` |
| PRJ-16 | Change role/title of an EDITOR/MEMBER (new role ≤ EDITOR) | 401 | D | D | D | D | A | A | D | `teams.ts:137`; `projects.ts:201-210 (updateProjectMember)` |
| PRJ-17 | Change role/title of an ADMIN or grant ADMIN | 401 | D | D | D | D | D | A | D | `authz.ts:100-101` |
| PRJ-18 | Grant OWNER via role change / change own role | 401 | D | D | D | D | D | D | D | `projects.ts:205-206` |
| PRJ-19 | Remove member below own rank | 401 | D | D | D | D | A | A | D | `projects.ts:224-225 (removeProjectMember)` |
| PRJ-20 | Remove the OWNER (as OD-ADM / org OWNER) | 401 | D | D | D | D | D | — | D | `authz.ts:100` — F-01 |
| PRJ-21 | Leave project | 401 | N | N | A | A | A | D (transfer first) | — | `projects.ts:221-222` |
| PRJ-22 | Transfer ownership to a direct member | 401 | D | D | D | D | D (incl. org OWNER) | A | D | `projects.ts:232-234`; test `tests/integration/networking.test.ts:117` |
| PRJ-23 | Archive / restore (archive closes OPEN opportunities) | 401 | D | D | D | D | D | A | D | `projects.ts:243-245` |
| PRJ-24 | Cancel pending project invitation | 401 | D | D | D | D | A | A | D | `invitations.ts:107` |
| PRJ-25 | Publish post as project | 401 | D | D | D | A | A | A | D | `authz.ts:120-124` (ACTIVE required, PRIVATE allowed — F-20) |
| PRJ-26 | Publish (OPEN) opportunity for a PUBLIC project | 401 | D | D | D | A | A | A | D | `src/server/opportunities.ts:71-76` |
| PRJ-27 | Publish opportunity for a PRIVATE project (drafts allowed) | 401 | N | N | D | D | D | D | D | `opportunities.ts:73-76`, `:125-128`, `:154-157` |
| PRJ-28 | Follow project | 401 | A (PUBLIC+ACTIVE only) | A | A | A | A | A | A | `graph.ts:196-199` |
| PRJ-29 | Partnerships (request/respond/cancel/end) for the project | 401 | D | D | D | D | A | A | D | `partnerships.ts:15-18` |
| PRJ-30 | Delete posts/comments published as the project | 401 | D | D | D | D | A (server); UI only for direct OWNER/ADMIN | A | D | `posts.ts:216-221 (canModeratePost)` vs `posts.ts:95-96,113-115` — F-19 |
| PRJ-31 | Create project (personal) | 401 | A (UNV: V) | A | A | A | A | A | A | `teams.ts:95`; `projects.ts:37-55` |

---

## 5. Opportunity (`OPP`)

`MGR` as defined in §0. `TEAM` = project member who is not a manager (P-MEM). `BLK` = blocked with the opportunity's `createdById`.

| ID | Action / state | ANON | MBR | BLK | TEAM | MGR | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OPP-01 | View OPEN opportunity of an active public owner | A | A | N | A | A | A | `src/server/opportunities.ts:172-197 (getOpportunity)`; block `:196` |
| OPP-02 | View DRAFT | N | N | N | N | A | A | `opportunities.ts:192` |
| OPP-03 | View CLOSED / FILLED / ARCHIVED (direct link) | A | A | N | A | A | A | `opportunities.ts:191-197` (only DRAFT rejected) |
| OPP-04 | View REMOVED | N | N | N | N | N | N | `opportunities.ts:189` |
| OPP-05 | View opportunity of a PRIVATE or ARCHIVED project | N | N | N | N (F-07) | A | A | `opportunities.ts:193` — TEAM sees it listed on the project page (`projects.ts:120`) but gets 404 on detail (F-07) |
| OPP-06 | View opportunity owned by an ARCHIVED org | N | N | N | — | A | A | `opportunities.ts:194` |
| OPP-07 | View personal opportunity whose creator is not ACTIVE | N | N | N | — | — | A | `opportunities.ts:195` |
| OPP-08 | Listed in `/opportunities`, search, tag pages, project search "looking for", recommendations, home page | publicOpportunityWhere | same + creator not blocked | N | same | same | same | `src/server/opportunity-visibility.ts:8-18`; `src/server/search.ts:220-221`; `src/server/matching.ts:78-89`; `opportunities.ts:242` — creator-status side effect F-14 |
| OPP-09 | Create personal opportunity | 401 | A (UNV: V) | — | — | — | A | `src/app/actions/opportunities.ts:16`; `opportunities.ts:71` |
| OPP-10 | Create as org / project | 401 | D | — | D | A (EDITOR+) | D | `opportunities.ts:71` → `authz.ts:111-127` |
| OPP-11 | Edit (any non-REMOVED status) | 401 | D | — | D | A (UNV too) | D | `actions/opportunities.ts:26 (requireViewer)`; `opportunities.ts:122 (assertCanManageOpportunity)` |
| OPP-12 | Publish a DRAFT via edit form | 401 | D | — | D | A (UNV: A*) | D | `opportunities.ts:123-128` checks PRIVATE only; not ARCHIVED/REMOVED project nor org status — F-07, F-15 |
| OPP-13 | Status change (OPEN/CLOSED/FILLED/ARCHIVED per `ALLOWED_STATUS`) | 401 | D | — | D | A (UNV: A*) | D | `actions/opportunities.ts:37`; `opportunities.ts:151-157`; OPEN requires project PUBLIC+ACTIVE, org status unchecked (F-07) |
| OPP-14 | Apply (personal), OPEN, accepting | 401 | A (UNV: V) | N | A | D (managers can't apply) | A | `actions/opportunities.ts:53`; `src/server/applications.ts:36-45` |
| OPP-15 | Apply to DRAFT / REMOVED | N | N | N | N | N | N | `applications.ts:36` |
| OPP-16 | Apply to opportunity of PRIVATE / non-ACTIVE project | N | N | N | N | N | N | `applications.ts:37` |
| OPP-17 | Apply to CLOSED/FILLED/ARCHIVED or past deadline | D | D | D | D | D | D | `applications.ts:38`; `opportunity-visibility.ts:27` |
| OPP-18 | Apply to org-owned opportunity of ARCHIVED org (after reopen) / personal opportunity of a SUSPENDED creator | 401 | A* | — | — | — | A* | `applications.ts:36-40` (no org/creator status check) — F-07 |
| OPP-19 | Apply when blocked with a manager who is not the creator | 401 | — | A* (NE) | — | — | — | `applications.ts:40` (creator only) — F-09 |
| OPP-20 | List managed opportunities (`/opportunities/manage`) | 401 | own scope | — | none | A | own scope | `opportunities.ts:206-232 (listManagedOpportunities)` |
| OPP-21 | Open edit page | 401 | N | — | N | A | N | `opportunities.ts:234-235`; `src/app/(app)/opportunities/[id]/edit/page.tsx:15` |
| OPP-22 | See "Suggested people" panel | — | — | — | — | A (page-level only) | — | `src/app/(app)/opportunities/[id]/page.tsx:118,162`; `matching.ts:103` has no auth of its own |
| OPP-23 | Receive OPPORTUNITY_MATCH notification on publish | — | if matched & not blocked by publisher | N | excluded | excluded | if matched | `matching.ts:140-161`, `notifications.ts:27` |
| OPP-24 | Managers after the project moves to another org | — | — | — | — | new org's EDITOR+ gain, old org's lose | — | `opportunities.ts:45` → `authz.ts:63-67` (current org). Consistent with `applications.ts:150-156` |

---

## 6. Application (`APP`)

| ID | Action | ANON | APPL | MGR | Other MBR | TEAM (non-manager) | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-01 | Submit personal application | 401 | A (UNV: V) | D | A | A | A | see OPP-14 |
| APP-02 | Submit on behalf of org where actor is EDITOR+ | 401 | A | — | — | — | — | `applications.ts:41` |
| APP-03 | Submit on behalf of org where actor is MEMBER / not a member | 401 | D | — | D | D | D | `applications.ts:41`; test `tests/integration/collaboration.test.ts:163` |
| APP-04 | Re-apply after WITHDRAWN | 401 | A | — | — | — | — | `applications.ts:44-45` |
| APP-05 | Withdraw (not ACCEPTED/REJECTED) | 401 | A | N | N | N | N | `actions/opportunities.ts:62`; `applications.ts:74-78` |
| APP-06 | Change status (per `STATUS_FLOW`) | 401 | D | A | D | D | D | `actions/opportunities.ts:71`; `applications.ts:96-98` |
| APP-07 | Change status on REMOVED opportunity / ARCHIVED or REMOVED project | 401 | D | A* | D | D | D | `applications.ts:91-96` (no state check) — F-22 |
| APP-08 | ACCEPTED adds applicant to project team as MEMBER | — | — | A (default `addToTeam`) | — | — | — | `applications.ts:104-111` (upsert never changes an existing role) |
| APP-09 | View own sent applications (status timeline, no notes) | 401 | A | — | — | — | — | `applications.ts:135-145` (events select excludes `note`) |
| APP-10 | View received applications incl. applicant card, message, portfolio, events with notes | 401 | N | A | N | N | N | `applications.ts:149-177`; page `src/app/(app)/applications/received/page.tsx:25` |
| APP-11 | Received list hides blocked applicants | — | — | NE | — | — | — | `applications.ts:157-176` — F-09 |
| APP-12 | Application opens a message channel to managers despite "connections only" | — | A (to creator and direct EDITOR+ members) | A (reverse) | — | — | — | `applications.ts:181-191`; `src/server/messaging.ts:38`; delegated org roles not counted |
| APP-13 | APPLICATION_RECEIVED notifications | — | — | direct project/org EDITOR+ only (not delegated) | — | — | — | `opportunities.ts:58-68` |

---

## 7. Post, repost (`POST`)

`ENT-ADM` = ADMIN+ (effective, incl. delegated) of the project/org the post was published as.

| ID | Action / state | ANON | MBR | AUTHOR | BLK (author) | ENT-ADM | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST-01 | View PUBLISHED post, ACTIVE author, public entity | A | A | A | N | A | A | `src/server/posts.ts:234-241 (getPost)` → `visiblePostWhere :55-65` |
| POST-02 | View post published as PRIVATE / ARCHIVED project or ARCHIVED org | N | N | N | N | N | A | `posts.ts:60-61`; documented limitation (ARCHITECTURE §11) |
| POST-03 | View REMOVED (moderated) post | N | N | N | N | N | A | `posts.ts:236` |
| POST-04 | View DELETED post | N | N | N | N | N | N | `posts.ts:236` |
| POST-05 | View post whose author is suspended / deactivated / deleted | N | N | — | N | N | A | `posts.ts:58` |
| POST-06 | Create as self | 401 | A (UNV: V) | — | — | — | A | `src/app/actions/social.ts:110`; `posts.ts:148-150` |
| POST-07 | Create as project / org | 401 | D | — | — | A (EDITOR+) | D | `posts.ts:150` → `authz.ts:111-127` |
| POST-08 | Attach images | 401 | own uploads only | — | — | — | own only | `posts.ts:151` → `uploads.ts:74-83` |
| POST-09 | Attach an opportunity (`opportunityId`) | 401 | A* (any OPEN opportunity, not only own) | — | — | — | A* | `posts.ts:162-165` — F-06 |
| POST-10 | Share/quote a visible post | 401 | A (UNV: V) | A | N | A | A | `posts.ts:154-157` |
| POST-11 | Share a share (resolves to the original) | 401 | A* | A | A* (original's author not re-checked) | — | — | `posts.ts:159-160` — F-05 |
| POST-12 | Delete | 401 | D | A | D | A (server) / `UI` for delegated roles | D (staff use moderation) | `actions/social.ts:120`; `posts.ts:223-226` — F-19 |
| POST-13 | Like / unlike | 401 | A (UNV: A) | A | N | A | A | `actions/social.ts:133`; `posts.ts:260-263` |
| POST-14 | Save / unsave | 401 | A (UNV: A) | A | A (no block check; filtered at listing) | A | A | `posts.ts:344-354`; `posts.ts:356-365` |
| POST-15 | See likers list | A | A | A | A* (blocked likers not filtered) | A | A | `posts.ts:390-396`; `src/app/(app)/posts/[id]/page.tsx:18` — F-09 |
| POST-16 | Feed "for you" / "latest" | 401 | visible posts, blocked authors removed | — | N | — | — | `src/server/feed.ts:98,110,122` |
| POST-17 | Post search, tag pages, entity/profile post lists | A (visible) | A | A | N | A | A | `src/server/search.ts:296`; `posts.ts:370-387`; `src/app/(app)/tags/[slug]/page.tsx:25` |
| POST-18 | Reposted original hidden (removed, private project, blocked) | shown as unavailable | same | same | same | same | same | `posts.ts:67-73,104-108 (hydratePosts)` |

---

## 8. Comment (`CMT`)

| ID | Action | ANON | MBR | COMMENT AUTHOR | POST AUTHOR | ENT-ADM | BLK with post author | BLK with parent-comment author | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMT-01 | Comment on a visible post | 401 | A (UNV: V) | — | A | A | N | — | A | `actions/social.ts:151`; `posts.ts:291-295` |
| CMT-02 | Reply to a comment | 401 | A | A | A | A | N | A* (NE) | A | `posts.ts:296-300` — F-09 |
| CMT-03 | Comment on hidden post (private project, removed, …) | N | N | N | N | N | N | N | N | `posts.ts:293` |
| CMT-04 | View comments | A | A | A | A | A | blocked authors' comments hidden | same | A | `posts.ts:243-258`; only reachable after `getPost` (`posts/[id]/page.tsx:16-18`) |
| CMT-05 | Delete comment (and its replies) | 401 | D | A | A | A | — | — | D | `actions/social.ts:160`; `posts.ts:332-336` |

---

## 9. Follow (`FOL`)

| ID | Action | ANON | MBR | target T | BLK | Enforced at |
| --- | --- | --- | --- | --- | --- | --- |
| FOL-01 | Follow user (ACTIVE) | 401 | A (UNV: A); PENDING if T requires approval and not connected | — | N | `actions/social.ts:71`; `graph.ts:187-192` |
| FOL-02 | Follow org (ACTIVE) / project (ACTIVE+PUBLIC) | 401 | A | — | — | `graph.ts:193-199` |
| FOL-03 | Unfollow | 401 | A (own rows only) | — | — | `graph.ts:222-224` |
| FOL-04 | Approve / decline follow request | 401 | N | A (own requests only) | — (rows deleted on block) | `graph.ts:226-231` |
| FOL-05 | Turning approval off auto-accepts pending requests | — | — | A | — | `profiles.ts:153-156` |

## 10. Connection (`CON`)

| ID | Action | ANON | MBR | Requester | Recipient | BLK | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CON-01 | Send request | 401 | A (UNV: V) | — | — | N | `actions/social.ts:34`; `graph.ts:47-51` |
| CON-02 | Re-send within 14 days of a decline | 401 | — | D | — | — | `graph.ts:65-69` |
| CON-03 | Accept / decline | 401 | N | N (requester can't accept) | A | — (rows deleted on block) | `graph.ts:86-89` |
| CON-04 | Cancel own pending request | 401 | N | A | N | — | `graph.ts:102-106` |
| CON-05 | Remove connection | 401 | N | A | A | — | `graph.ts:108-112` |

## 11. Block (`BLK`)

| ID | Action | ANON | MBR | target is STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- |
| BLK-01 | Block a user (deletes connection + follows both ways) | 401 | A | D | `actions/social.ts:99`; `graph.ts:280-297` |
| BLK-02 | Unblock (own blocks only) | 401 | A | — | `actions/settings.ts:123`; `graph.ts:299-302` |
| BLK-03 | List own blocks | 401 | A | — | `graph.ts:304-311` |
| BLK-04 | Block cleans up conversations, invitations, partnerships, shared team membership, pending applications, old notifications | — | NE | — | `graph.ts:285-295` only touches Connection/Follow (see §20) |

---

## 12. Conversation / Message (`MSG`)

| ID | Action | ANON | PART | Non-participant | BLK (with the other participant) | STAFF | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MSG-01 | Start conversation, recipient `messagePermission=EVERYONE` | 401 | — | A (UNV: V) | D | A | `actions/social.ts:171`; `src/server/messaging.ts:29-45` |
| MSG-02 | Start conversation, recipient `CONNECTIONS` | 401 | — | A only if connected / application relation / shared project or org | D | same as MBR | `messaging.ts:36-40` |
| MSG-03 | Start conversation with a non-ACTIVE user | 401 | — | D | D | D | `messaging.ts:32` |
| MSG-04 | Read conversation / poll `/api/messages/:id` | 401 | A (even when blocked) | N | A (read-only) | N | `messaging.ts:59-73,128-147,158-159`; `src/app/api/messages/[id]/route.ts:9-13` |
| MSG-05 | Send message | 401 | A (UNV: V) | N | D | N | `actions/social.ts:179`; `messaging.ts:77-80` |
| MSG-06 | Existing conversation after recipient switches to `CONNECTIONS` | — | A | — | D | — | `messaging.ts:34-35` (by design) |
| MSG-07 | Open a conversation whose other participant deleted their account | — | crashes (500) | N | — | — | `messaging.ts:73,138` — F-13 |
| MSG-08 | Report a message | 401 | A | N | A | A | `src/server/moderation.ts:25-29` |

## 13. Notification (`NTF`)

| ID | Action | ANON | Recipient | Other user | Enforced at |
| --- | --- | --- | --- | --- | --- |
| NTF-01 | List notifications | 401 | A (own only) | N | `src/server/notifications.ts:49-52` |
| NTF-02 | Mark one as read by id | 401 | A | N (no-op: scoped by `userId`) | `actions/social.ts:191`; `notifications.ts:68-70` |
| NTF-03 | Mark all as read | 401 | A | — | `notifications.ts:72-74` |
| NTF-04 | Redirect after mark-read to a form-supplied `href` | — | A* (`/\host` not rejected) | — | `actions/social.ts:193-194` — F-17 |
| NTF-05 | Receive a notification from a blocked actor | — | N | — | `notifications.ts:27` (central) |
| NTF-06 | Receive notifications while not ACTIVE | — | N | — | `notifications.ts:26` |

---

## 14. Partnership (`PSH`)

Side A = requester entity, side B = target entity. `x-ADM` = ADMIN+ of that side (effective, incl. delegated for projects).

| ID | Action | ANON | MBR | A-ADM | A-EDT | B-ADM | B-EDT | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PSH-01 | Request (target ACTIVE and PUBLIC) | 401 | D | A (UNV: V) | D | — | — | `actions/teams.ts:220`; `src/server/partnerships.ts:46-51` |
| PSH-02 | Request targeting a PRIVATE / ARCHIVED / REMOVED entity | 401 | D | N | D | — | — | `partnerships.ts:51` |
| PSH-03 | Request **from** a PRIVATE project | 401 | D | A* (name sent to B admins) | D | — | — | `partnerships.ts:49-51,88-90` — F-18 |
| PSH-04 | Mirror request while one is pending (auto-accept) | — | — | — | — | A | D | `partnerships.ts:57-62` |
| PSH-05 | Accept / decline | 401 | D | D | D | A (UNV: A) | D | `actions/teams.ts:232`; `partnerships.ts:103-107` |
| PSH-06 | Cancel pending request | 401 | D | A | D | D | D | `partnerships.ts:124-127` |
| PSH-07 | End active partnership | 401 | N | A | N | A | N | `partnerships.ts:131-137` |
| PSH-08 | Re-request after decline (no cooldown, no rate limit) | — | — | A* | — | — | — | `partnerships.ts:64-77` — F-18 |
| PSH-09 | Public partner lists hide private/inactive other side | A | A | A | A | A | A | `partnerships.ts:171-176` |

## 15. Invitation (`INV`)

| ID | Action | ANON | Invitee | Other MBR | Current entity ADMIN+ | Inviter after demotion/removal | Enforced at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-01 | Create (see ORG-09/10, PRJ-14/15); invitee must be ACTIVE, not blocked with inviter, not already a member | 401 | — | D | A (UNV: V) | D | `src/server/invitations.ts:13-19,26-32,47-53` |
| INV-02 | Accept / decline | 401 | A (UNV: A) | N | N | N | `actions/teams.ts:189`; `invitations.ts:73` |
| INV-03 | Accept into ARCHIVED/REMOVED entity | 401 | N | N | N | N | `invitations.ts:74-75` |
| INV-04 | Accept an invitation whose inviter has since lost `manageMembers` or left | 401 | A* (role granted as snapshotted) | — | — | — | `invitations.ts:80-92` — F-02 |
| INV-05 | Cancel | 401 | N (decline instead) | D | A | D | `invitations.ts:104-110` |
| INV-06 | List own pending invitations | 401 | A | — | — | — | `invitations.ts:112-123` |
| INV-07 | See pending invitations of an entity | 401 | — | N | A (EDITOR+ via manage pages) | — | `projects.ts:154-158`, `organizations.ts:157-160` |

---

## 16. Report and moderation (`MOD`)

| ID | Action | ANON | MBR | MOD | ADM | Enforced at |
| --- | --- | --- | --- | --- | --- | --- |
| MOD-01 | File a report (any target type; MESSAGE only by participants; not on self) | 401 | A (UNV: A) | A | A | `actions/social.ts:213`; `moderation.ts:21-34` |
| MOD-02 | Probe existence of any id via report | 401 | A* | A | A | `moderation.ts:9-23` — F-23 |
| MOD-03 | Open `/moderation`, list reports with previews | 401 | N | A | A | `src/app/(app)/moderation/page.tsx:19-20`; `moderation.ts:75-76` |
| MOD-04 | Resolve report: dismiss / remove content / restore | 401 | D | A | A | `actions/social.ts:221`; `moderation.ts:92-96` |
| MOD-05 | Action label matches what happens | — | — | A* (`suspend_user` on a POST removes the post; `restore` on ARCHIVED project activates it) | A* | `moderation.ts:96,104-130` — F-16 |
| MOD-06 | Suspend / restore a USER | 401 | D | A | A | `moderation.ts:132-142`; `actions/social.ts:232` |
| MOD-07 | Suspend / restore a MODERATOR | 401 | D | D | A | `moderation.ts:136` |
| MOD-08 | Suspend / restore an ADMIN | 401 | D | D | D | `moderation.ts:136` |
| MOD-09 | Restore a user suspended by an ADMIN | — | — | A* | A | `moderation.ts:136` (no record of who suspended) — F-16 |
| MOD-10 | Restore a DEACTIVATED (self-deactivated) user | — | — | A* | A* | `moderation.ts:138` — F-16 |
| MOD-11 | View audit log (all actors, IPs, metadata) | 401 | D / N | A | A | `moderation.ts:144-146`; `moderation/page.tsx:34` — F-16 (confirm intent) |
| MOD-12 | Staff see REMOVED posts, private projects, drafts | — | — | A | A | `posts.ts:236`; `projects.ts:114`; `opportunities.ts:191`; `authz.ts:76` |

## 17. MediaAsset (`MED`)

| ID | Action | ANON | MBR | Uploader | Enforced at |
| --- | --- | --- | --- | --- | --- |
| MED-01 | Upload (`POST /api/uploads`, same-origin) | 401 | A (UNV: A) | — | `src/app/api/uploads/route.ts:13-14`; `src/server/http.ts:26-35`; `uploads.ts:34-71` |
| MED-02 | Reference a key in profile/org/project/post/gallery | — | D (not own) | A | `uploads.ts:74-83`; callers `profiles.ts:125`, `organizations.ts:19,58`, `projects.ts:40,76,187`, `posts.ts:151` |
| MED-03 | Fetch `/api/media/<key>` (incl. private project gallery, members-only avatars, deleted users' files) | A (capability URL: 144-bit random key) | A | A | `src/app/api/media/[...key]/route.ts:4-15`; `uploads.ts:86-95` (path checks only) — F-12 |

## 18. AuditLog (`AUD`)

| ID | Action | ANON | MBR | MOD | ADM | Enforced at |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-01 | Read | 401 | D | A | A | `moderation.ts:144-146` |
| AUD-02 | Write (system only, no user-facing path) | — | — | — | — | `src/server/audit.ts:16` |

## 19. Other endpoints (`EP`)

| ID | Endpoint | ANON | MBR | Enforced at |
| --- | --- | --- | --- | --- |
| EP-01 | `GET /api/tags` (tag names, usage counts) | A | A | `src/app/api/tags/route.ts:7-11` (public by design) |
| EP-02 | `GET /api/health` | A | A | `src/app/api/health/route.ts` |
| EP-03 | `POST /api/cron/notification-emails` | D unless `Bearer CRON_SECRET` (D when secret unset) | same | `src/app/api/cron/notification-emails/route.ts:8-12` |
| EP-04 | `/dev/mailbox` (all outgoing emails incl. reset links) | A* when `NODE_ENV !== "production"`, N in production | A* | `src/app/(app)/dev/mailbox/page.tsx:15` — F-04 |

---

## 20. Cross-surface rules

### 20a. Blocks (viewer V and user X blocked in either direction)

| Surface | X hidden from V / interaction denied? | Location |
| --- | --- | --- |
| X's profile page | Yes (404) | `profiles.ts:30` |
| X's connection/follower/following lists | Yes (profile 404 first) | `connections/page.tsx:16-17` |
| X shown inside **third parties'** connection/follower lists | **No** | `graph.ts:127-139,255-276` |
| People search, tag-page people panel | Yes | `search.ts:73,78` |
| "People you may know" | Yes | `matching.ts:172` |
| "Suggested people" on V's opportunity | **No** | `opportunities/[id]/page.tsx:225` (passes `[]`) |
| `/api/mentions` autocomplete | **No** | `api/mentions/route.ts:12-30` |
| Mention notifications | Yes (suppressed) | `posts.ts:143`, `notifications.ts:27` |
| Mention link rendering in X's post | Still linked (Mention row stored) | `posts.ts:120-133` |
| Feed (both modes), post search, tag-page posts, entity/profile post lists, saved list | Yes (by author) | `feed.ts:110,122`; `search.ts:296`; `posts.ts:379`; `posts.ts:359` |
| Reposted original by X inside a third party's share | Yes (rendered unavailable) | `posts.ts:104-108` |
| Creating a share of X's post | Yes for direct share; **No** via share-of-share | `posts.ts:157` vs `:159` (F-05) |
| Post detail / like / comment on X's post | Yes (404) | `posts.ts:236,263,295` |
| Reply to X's comment on a third party's post | **No** | `posts.ts:296-300` |
| X's comments under any post | Yes (hidden) | `posts.ts:246` |
| Likers list | **No** | `posts.ts:390-396` |
| Notifications from X | Yes | `notifications.ts:27` |
| Follow / connect | Yes | `graph.ts:50,190` |
| Message start / send | Yes (existing thread readable, not writable) | `messaging.ts:33,80` |
| Invitations | Only at creation | `invitations.ts:17` |
| Opportunities created by X (detail, search, recommendations, apply) | Yes | `opportunities.ts:196`; `search.ts:221`; `matching.ts:86`; `applications.ts:40` |
| Opportunities managed (not created) by X | **No** | `applications.ts:40` |
| X's applications in V's received list | **No** | `applications.ts:157-176` |
| Project/org member lists containing X | **No** | `projects.ts:103-109`, `organizations.ts:95-101` |
| Partnerships between entities administered by V and X | **No** (no user-level check) | `partnerships.ts:46-79` |
| OPPORTUNITY_MATCH to users who blocked the publisher | Yes | `matching.ts:146-147` |

### 20b. Private projects (visibility PRIVATE) and ARCHIVED/REMOVED projects

| Surface | Non-member outcome | Location |
| --- | --- | --- |
| Project page | 404 (staff: visible; REMOVED: 404 for all) | `projects.ts:112-116` |
| Project search / tag-page projects / complementary suggestions | Excluded | `search.ts:130`; `projects.ts:265-266` |
| Org page project list | Excluded for non-org-members; **shown to every org member incl. MEMBER** | `organizations.ts:110` (F-08) |
| Profile project lists | Excluded (even for teammates) | `profiles.ts:43` |
| Following list of a user | Excluded | `connections/page.tsx:70`; `projects.ts:175` |
| Posts published as the project | Hidden for everyone except staff (team included) | `posts.ts:60` |
| Feed | Excluded | `feed.ts` via `visiblePostWhere` |
| Mentions autocomplete / mention resolution | Excluded | `api/mentions/route.ts:26`; `handles.ts:37` |
| Notifications | **Leak**: ENTITY_UPDATE to followers and MENTION excerpts still sent when posting as a private project | `posts.ts:198-199` (F-20) |
| Partnership request from a private project | **Leak**: name in notification | `partnerships.ts:88-90` (F-18) |
| Opportunity detail | 404 | `opportunities.ts:193` |
| Opportunity listings, search, recommendations | Excluded | `opportunity-visibility.ts:13` |
| Apply | 404 | `applications.ts:37` |
| Publishing an opportunity | Blocked (create, edit-publish, reopen) | `opportunities.ts:73-76,125-128,154-157` |
| Opportunities already OPEN when the project turns PRIVATE | Stay OPEN; can still be embedded in posts | `projects.ts:79` (no close) + `posts.ts:162-165` (F-06, F-07) |
| OPPORTUNITY_MATCH when a draft of an ARCHIVED/REMOVED project is published via edit | **Sent** | `opportunities.ts:125-138` (F-07) |
| Matching candidates for its opportunities | Page-level only (managers) | `opportunities/[id]/page.tsx:118,162` |
| Follow | Denied | `graph.ts:198` |
| Media files under `/api/media` | Served to anyone with the key | `api/media/[...key]/route.ts` (F-12 note) |
| Reports | Target id existence confirmed | `moderation.ts:14` (F-23) |

### 20c. Members-only profiles (visibility MEMBERS) for ANON

| Surface | Outcome | Location |
| --- | --- | --- |
| Profile page | Stub (name + avatar) | `profiles.ts:33` |
| People search / tag-page people | Excluded | `search.ts:76` |
| Suggested people | Excluded | `matching.ts:125` |
| Post author cards (feed n/a for ANON; tag pages, post page, search, entity pages) | **Shown** (name, headline, avatar) | `posts.ts:33`; `tags/[slug]/page.tsx:25` |
| Comment authors, likers | **Shown** | `posts.ts:251,395` |
| Project / org member lists | **Shown** (name, headline, avatar) | `projects.ts:107`; `organizations.ts:99` |
| Third parties' connection/follower/following lists | **Shown** via `PersonCard` (name, headline, avatar, availability, location if `showLocation`) | `graph.ts:127-139,255-276`; `entity-cards.tsx:13-34` |
| Personal opportunity cards (createdBy) | **Shown** (name, avatar) | `selects.ts:61` |

### 20d. Suspended / deactivated / deleted accounts

| Surface | Outcome | Location |
| --- | --- | --- |
| Sign-in / sessions | See AUTH-01..04 | `service.ts` |
| Profile, search, mentions, member lists, likers, connection lists, followers | Hidden | `profiles.ts:29`; `search.ts:75`; `api/mentions/route.ts:24`; `projects.ts:130`; `organizations.ts:129`; `posts.ts:392`; `graph.ts:132,257` |
| Posts and comments | Hidden (restored on reactivation) | `posts.ts:58,246` |
| Opportunities they created (any owner kind) | Hidden from listings; detail hidden only for personal ones | `opportunity-visibility.ts:15` vs `opportunities.ts:195` (F-14) |
| Applying to their personal opportunities | Allowed by id | `applications.ts:36-40` (F-07) |
| Their applications in managers' received lists | Still shown | `applications.ts:157-176` |
| Messages | Existing threads keep their messages; new messages to them denied | `messaging.ts:32,79` |
| Notifications to them | Not created | `notifications.ts:26` |
| Deleted: handle | Released and re-claimable; old mentions link to the new owner | `service.ts:320`; `rich-text.tsx:32` (F-12) |
| Deleted: conversations | Other participant's thread crashes | F-13 |

---

## 21. Discrepancies and suspected bugs

Severity: P0 critical (exploitable takeover/data breach), P1 high, P2 medium, P3 low. All items were verified by reading the code unless marked **unverified**. No P0/P1 issue was found in the service layer.

### F-01 (P2) Org-owned projects are controlled by their direct OWNER, not by the organization
- Location: `src/server/projects.ts:38,48` (`createProject`: any org EDITOR can create an org project and becomes its direct OWNER), `src/server/authz.ts:65` (delegation capped at ADMIN), `src/server/authz.ts:100` (`canManageMember`: ADMIN can't touch OWNER), `src/server/projects.ts:72-75` (`updateProject`: detaching needs only project `owner`; attaching needs only EDITOR in the target org), `src/server/organizations.ts:181-191` (`removeOrgMember` leaves project memberships intact).
- Scenario: Org editor E creates "Acme Mobile" under org Acme. Acme's OWNER removes E from the org. E is still the project's OWNER: E can rename the handle, archive it, transfer it to an outsider, or set `organizationId` to null, taking the project (with its posts, opportunities and applicants) out of Acme. Acme's OWNER, acting as delegated ADMIN, cannot remove E (`PRJ-20`), transfer (`PRJ-22`), archive (`PRJ-23`) or detach (`PRJ-12`). Conversely, any org EDITOR who owns a project can attach it to the org's public page without ADMIN approval (`ORG-23`).
- Note: `tests/integration/networking.test.ts:117` encodes the cap, so this may be intended; it contradicts the expectation that an org owns its projects.
- Fix: treat org OWNER as project OWNER (delegated OWNER for org OWNER), require org ADMIN+ to attach a project and to detach it, and/or create org projects with the org as the owner (creator as ADMIN).

### F-02 (P2) Invitations are not re-authorized when accepted
- Location: `src/server/invitations.ts:68-92` (`respondToInvitation` grants `inv.role` with no check of the inviter's current rights); demotion/removal paths `src/server/projects.ts:200-228`, `src/server/organizations.ts:170-191` don't cancel the person's pending invitations.
- Scenario: Project ADMIN M invites two sock-puppet accounts as EDITOR, then is removed from the team. The invitations stay PENDING; both accounts accept later and become EDITORs (edit project, publish as the project, manage opportunities, read applicants and reviewer notes). Same for a former org ADMIN, and for an ex-OWNER's pending ADMIN invitations after transferring ownership.
- Fix: at acceptance, re-run `assertGrantable` with the inviter's current role (or require that some current ADMIN+ could grant it); cancel an actor's pending invitations when they are demoted/removed; add an expiry.

### F-03 (P2) Members-only profiles are exposed to signed-out visitors through cards
- Location: `src/server/posts.ts:33` (post author), `posts.ts:251` (comment authors), `posts.ts:390-396` + `src/app/(app)/posts/[id]/page.tsx:18` (likers), `src/server/projects.ts:107` + `src/app/(app)/p/[slug]/page.tsx:184` (project members), `src/server/organizations.ts:99` + `src/app/(app)/o/[slug]/page.tsx:143` (org members), `src/server/social/graph.ts:127-139,255-276` + `src/app/(app)/u/[username]/connections/page.tsx:44-71` (connection/follower/following lists rendered with `PersonCard`, which shows headline, availability and location when `showLocation`), `src/server/selects.ts:61` (personal opportunity cards).
- Scenario: Maria sets visibility MEMBERS. A visitor who is not signed in opens `/u/<a public friend>/connections?tab=followers` or a public project page where Maria is a member, and sees Maria's name, headline, avatar, availability and city. Only the profile page, people search and suggested people honor the setting (`profiles.ts:33`, `search.ts:76`, `matching.ts:125`).
- Fix: a shared `visibleUserCardWhere(viewer)` / redaction helper: for ANON, replace MEMBERS-only users with a minimal stub (name + avatar, as the profile stub does) or omit them, in all of the selects above.

### F-04 (P2, environment-dependent) `/dev/mailbox` is unauthenticated outside production
- Location: `src/app/(app)/dev/mailbox/page.tsx:13-16`; not covered by `src/proxy.ts:8-26`; `NODE_ENV` defaults to `development` (`src/server/env.ts:10`).
- Scenario: Any instance run with `next dev` or `NODE_ENV=test` that is reachable by others (shared staging, demo, preview) lets anyone, signed in or not, read the last 30 emails, including password-reset and verification links for other users, and take over their accounts. `next start` and the Docker image set production, so the shipped build is not affected (Dockerfile sets `NODE_ENV=production`).
- Fix: require `isStaff(viewer)` plus an explicit `DEV_MAILBOX=1` flag, or move it out of the app routes.

### F-05 (P3) Sharing a share bypasses the block and visibility checks on the original
- Location: `src/server/posts.ts:154-160`. Only the intermediate share is checked; the original fetched at `:159` is not re-checked against `visiblePostWhere` or `isBlockedEitherWay`.
- Scenario: A blocked B. C shares A's post. B shares C's share: B's post is created with `repostOfId` = A's post and A's `shareCount` is incremented (the POST_SHARE notification is suppressed by `notify`). The same path lets anyone create shares of a REMOVED/DELETED or private-project original that has an older share (it renders as unavailable through `hydratePosts`, but counters change).
- Fix: run the same visibility and block checks on the resolved original.

### F-06 (P3) Any user can attach any OPEN opportunity to a post
- Location: `src/server/posts.ts:162-165` (status check only, no `canManageOpportunity`, no owner visibility check); the embedded card is selected at `posts.ts:36-41`.
- Scenario: (a) Users publish `OPPORTUNITY`-type posts that present another team's opportunity as their own. (b) Together with F-07, an OPEN opportunity of a project that was switched to PRIVATE can be embedded in a public post, exposing its title, skills and collaboration type.
- Fix: require `canManageOpportunity`, or at least `publicOpportunityWhere` for the attached opportunity; re-check visibility when rendering.

### F-07 (P3) Opportunity state is not kept consistent with project/org state
- Location:
  - `src/server/projects.ts:79`: switching to PRIVATE doesn't close OPEN opportunities (archiving does, `:245`).
  - `src/server/opportunities.ts:125-128`: publishing a draft through the edit form checks only `visibility`, not project status or org status, then runs `afterPublish` (`:99-118`), which sends OPPORTUNITY_MATCH notifications (`src/server/matching.ts:140-161`) for opportunities of ARCHIVED/REMOVED projects or archived/removed orgs.
  - `opportunities.ts:154-157`: reopening checks the project only; an org-owned opportunity of an ARCHIVED org can be reopened.
  - `src/server/applications.ts:36-40`: applying doesn't check org status or the personal creator's status (OPP-18), so applications by id still work in those states.
  - `opportunities.ts:191-193`: a non-manager team member (P-MEM) gets 404 on the detail page of their own private project's opportunity, although `projects.ts:120` lists it for them (OPP-05).
- Fix: one `opportunityOwnerActive(o)` predicate used by publish, reopen, apply and detail; close OPEN opportunities when a project goes PRIVATE; let any project role view the detail page.

### F-08 (P3) Org MEMBERs see the org's private projects
- Location: `src/server/organizations.ts:110` (`viewerRole ? {}` includes MEMBER), rendered at `src/app/(app)/o/[slug]/page.tsx:116`; but org MEMBER gets no delegated project role (`src/server/authz.ts:65-66`), so the project page is a 404 for them.
- Fix: filter private projects by `hasRank(viewerRole, "EDITOR")` or by actual project role.

### F-09 (P3) Blocks are not applied on several surfaces (see §20a)
- Location: `src/app/api/mentions/route.ts:12-30` (also ignores `searchable=false`); `src/app/(app)/opportunities/[id]/page.tsx:225` → `src/server/matching.ts:120` (suggested people); `src/server/posts.ts:390-396` (likers); `src/server/social/graph.ts:127-139,255-276` (third-party lists); `src/server/projects.ts:103-109`, `src/server/organizations.ts:95-101` (member lists); `src/server/applications.ts:157-176` (received applications); `applications.ts:40` (apply when blocked with a non-creator manager); `src/server/posts.ts:296-300` (reply to a blocker's comment); `src/server/partnerships.ts:46-79` (no user-level check).
- Scenario: V blocked X; V still gets X suggested as a candidate for V's opportunity, sees X in the mention picker, and X can reply under V's comments on a third party's post (V doesn't see it, but everyone else does). Notifications are suppressed centrally by `notify`.
- Fix: pass `blockedUserIds(viewer)` into these queries; block-check the parent comment author in `addComment`.

### F-10 (P3) Hidden location is used and disclosed in candidate suggestions
- Location: `src/server/matching.ts:17,33` load `profile.location` regardless of `showLocation`; `src/lib/matching-engine.ts:128` emits "Based near <city>"; shown to managers at `src/app/(app)/opportunities/[id]/page.tsx:245`.
- Scenario: A manager publishes an on-site role in each candidate city and reads the "Based near …" reasons to learn the hidden location of members who opted out. People search explicitly prevents this (`src/server/search.ts:92`; test `tests/integration/collaboration.test.ts:221`).
- Fix: set `location: showLocation ? location : null` in `toPerson` for anyone other than the person themselves.

### F-11 (P3) Followers/following lists ignore the connections-audience setting
- Location: `src/app/(app)/u/[username]/connections/page.tsx:32-39` gates only the connections tab; `listFollowers`/`listFollowing` (`graph.ts:255-276`) have no audience check.
- Fix: decide whether `connectionsVisible` covers follow lists (likely yes for ONLY_ME) and enforce it in the service.

### F-12 (P3) Account deletion leaves references that misattribute or retain data
- Location: `src/server/auth/service.ts:274-333`.
  - Mention rows aren't deleted, and `RichText` links by stored handle (`src/components/rich-text.tsx:32`). After the handle is freed (`service.ts:320`), whoever signs up with that username is linked from every old @mention. The same happens after project/org slug changes (`projects.ts:80-83`, `organizations.ts:77-80`).
  - `MediaAsset` rows and files aren't deleted; avatars/covers stay retrievable at `/api/media/<key>` by anyone who saved the URL.
  - Pending invitations **sent** by the user remain acceptable (with F-02); personal opportunities remain in their status (hidden by F-14 logic); `ApplicationEvent` notes remain.
  - Posts authored **as an org/project** by the user are hard-deleted (`service.ts:298`), erasing the entity's history.
- Fix: delete or neutralize Mention rows (or resolve mentions by id at render time); purge media; cancel sent invitations; archive personal opportunities; keep entity posts with an anonymized author.

### F-13 (P3) Conversations with a deleted participant crash
- Location: `src/server/messaging.ts:73` (`find(...)!`) after `deleteAccount` removes the participant row (`service.ts:301`); `getConversation` dereferences `other.userId` at `:138` (TypeError → 500 on `/messages/:id` and in `/api/messages/:id` via `sendMessage :79`).
- Fix: handle a missing counterpart (render "Deleted member", read-only).

### F-14 (P3) Listings hide project/org opportunities whose creator is no longer active
- Location: `src/server/opportunity-visibility.ts:15` applies `createdBy.status = ACTIVE` to every owner kind, while `src/server/opportunities.ts:195` applies it only to personal ones.
- Scenario: A team member who published the project's opportunities deactivates; all of them disappear from search, recommendations and tag pages but remain open on the project page and by link.
- Fix: apply the creator condition only when `projectId` and `organizationId` are both null.

### F-15 (P3) Email verification is not enforced on some publishing paths
- Location: `src/app/actions/opportunities.ts:26,37` (`requireViewer` on edit and status change, which can publish drafts and create announcement posts); `src/app/actions/teams.ts:189` (accept invitation unverified) followed by `requireViewer`-only management actions (`teams.ts:32,104,114,137,…`); `actions/social.ts:71,133,213` (follow, like, report: arguably fine).
- Scenario: An unverified account accepts an EDITOR invitation, then publishes a teammate's draft opportunity (announcement post + match notifications) and edits the project. Also, any user who changes email (`service.ts:249` clears verification) keeps these powers.
- Fix: use `requireVerifiedViewer` for every action that publishes or changes public content.

### F-16 (P3) Moderation semantics are looser on the server than in the UI
- Location: `src/server/moderation.ts:96,104-130,132-142,144-146`; UI restrictions at `src/app/(app)/moderation/page.tsx:67-90`.
  - The action label is ignored: `suspend_user` on a POST report removes the post (author not suspended); `remove_content` on a USER report suspends.
  - `restore` is unconditional: an owner-ARCHIVED project becomes ACTIVE (`:114`); a DRAFT or OPEN opportunity becomes CLOSED (`:121`; a DRAFT becomes publicly viewable, see OPP-03); a self-DEACTIVATED user becomes ACTIVE (`:138`).
  - A MODERATOR can lift a suspension imposed by an ADMIN (no record of who suspended).
  - Every MODERATOR reads the full audit log with IPs and admin actions (`:144-146`). ARCHITECTURE §4 says site roles unlock "the moderation console only", so confirm this is intended.
- Fix: validate action against target type; store the pre-removal status and restore to it; only restore REMOVED/SUSPENDED; consider ADMIN-only audit log and an ADMIN-only lift for ADMIN-imposed suspensions.

### F-17 (P3) Open redirect in `markNotificationReadAction`
- Location: `src/app/actions/social.ts:193-194` accepts `href` values like `/\evil.example` (browsers treat `\` as `/`). `src/app/actions/auth.ts:14` (`safeNext`) already rejects this form.
- Exploitability: low (Server Actions are Origin-checked, so it needs a same-origin form submission).
- Fix: reuse `safeNext`, or look up `href` from the notification row instead of the form.

### F-18 (P3) Partnership requests: private sender leaks, no throttling
- Location: `src/server/partnerships.ts:49-51` validates only the target's visibility; the sender's name goes into the notification text at `:88-90` even when the sender is a PRIVATE project (the receiving manage page then hides the row, `:171-176`, so it can't be answered). There is no `rateLimit` and no cooldown after DECLINED/CANCELED/ENDED (`:64-77`, unlike connections `graph.ts:65-69`).
- Fix: require the sender to be PUBLIC (or hide its name); add a rate limit and cooldown.

### F-19 (P3, UI-only) Delete buttons ignore delegated roles
- Location: `src/server/posts.ts:95-96,113-115` (`canDelete` from direct OWNER/ADMIN memberships) vs server `canModeratePost` `posts.ts:216-221` (effective roles). Used by `src/components/post-card.tsx:131` and `src/app/(app)/posts/[id]/comments.tsx:63`.
- Impact: org admins can delete org-project posts/comments only by crafting the action. Not a security issue, but table-driven tests must assert the server rule, not the UI.

### F-20 (P3) Posting as a PRIVATE project fans out notifications
- Location: `src/server/authz.ts:120-124` (status checked, visibility not); `src/server/posts.ts:198-199,203-213`.
- Scenario: A team member posts as the private project; followers (who followed while it was public) get "<Project> posted an update" and mentioned outsiders get an 80-character excerpt, while the post itself is invisible to everyone (`posts.ts:60`).
- Fix: skip follower fan-out and mention notifications for non-public entities, or reject posting as a private project.

### F-21 (P3, confirm intent) EDITORs can change project visibility
- Location: `src/server/projects.ts:65` (`edit`) with `visibility` in `projectData` (`:27`). ARCHITECTURE §4 reserves only handle/archive/transfer for OWNER. Making a private project public exposes the team and drafts' context.
- Fix: require ADMIN+ (or OWNER) for visibility changes.

### F-22 (P3) Application decisions ignore opportunity/project state
- Location: `src/server/applications.ts:91-114` (no check of opportunity REMOVED, project ARCHIVED/REMOVED, applicant status or blocks before upserting a `ProjectMember`).
- Fix: reuse `assertCanManageOpportunity` (rejects REMOVED) and refuse team insertion for inactive projects or blocked pairs.

### F-23 (P3) Report endpoint is an existence oracle
- Location: `src/server/moderation.ts:9-23`: `NOT_FOUND` vs success reveals whether any id exists (private project, draft opportunity). IDs are cuids, so practical risk is low.
- Fix: accept reports only for targets the reporter can view.

### F-24 (P3) Archived organizations still act as publishers in some paths
- Location: `src/server/authz.ts:86-93` rejects only REMOVED, so `createProject` (`projects.ts:38`) and "apply on behalf of" (`applications.ts:41`) accept ARCHIVED orgs (posting/opportunities are protected by `resolveActingAs`'s ACTIVE check, `authz.ts:116`).
- Fix: reject non-ACTIVE orgs for `publish`.

### Checked and found correct (no finding)
- Admins cannot grant ADMIN/OWNER or touch peers via invite, role change or removal (`authz.ts:96-103`, `invitations.ts:21-24`, `projects.ts:205-208`, `organizations.ts:174-176`). Delegated org roles never exceed project ADMIN (`authz.ts:65`).
- IDOR on id-based actions: post delete, comment delete, application status/withdraw, partnership accept/cancel/end, invitation accept/cancel, notification mark-read, session revoke, experience/education edit, gallery image removal, unblock, follow/connection responses, messages. All are scoped by actor or re-authorized (citations in the rows above).
- Reading another user's application events/notes: applicants only get status/date (`applications.ts:143`); notes are visible only to managers (`:175`).
- Applications on behalf of an org need EDITOR+ in that org (`applications.ts:41`, tested).
- Managing opportunities after a project changes org follows the current org consistently in `canManageOpportunity`, `listManagedOpportunities` and `listReceivedApplications` (OPP-24).
- Moderator cannot suspend an ADMIN or another MODERATOR (`moderation.ts:136`).
- Suspended users lose sessions immediately and their content is hidden (`moderation.ts:139`, `service.ts:109`, `posts.ts:58`).
- Message reports are limited to participants (`moderation.ts:25-29`). Uploads are re-encoded, path-checked and must be referenced by their uploader (`uploads.ts`).

---

## 22. Test coverage

Totals: 214 matrix rows / 1,219 action × subject cells in §1-§19, plus 64 cross-surface rules in §20. 85 rows have at least one asserted cell; 129 rows (733 cells) have no test at all. Covered rows are usually asserted for one or two subjects only, so the real number of untested cells is higher. None of the `A*` / `NE` cells (the findings) is tested.

Sources: `tests/integration/{auth,collaboration,networking,social}.test.ts`, `tests/e2e/*.spec.ts`. `tests/unit/lib.test.ts` covers pure helpers only (no authz rows).

### Rows covered (at least one cell asserted)

| Row | Test (file:line) |
| --- | --- |
| AUTH-01 | `tests/integration/auth.test.ts:49` (login), `:88-95` (deactivated reactivates, suspended denied) |
| AUTH-02 | `auth.test.ts:49` (session resolves) |
| AUTH-04 | `auth.test.ts:67` (reset + sessions revoked) |
| AUTH-10, AUTH-14 | `auth.test.ts:78` |
| AUTH-15 | `auth.test.ts:88-91` |
| AUTH-16 | `auth.test.ts:98-108` |
| AUTH-17 | `auth.test.ts:114` |
| PROF-01 (BLK) | `tests/integration/social.test.ts:76` |
| PROF-03 | `auth.test.ts:91` |
| PROF-04 (search only) | `tests/integration/collaboration.test.ts:217-221` |
| PROF-10 | `collaboration.test.ts:210-222` |
| ORG-09, ORG-10, INV-02, INV-05 | `tests/integration/networking.test.ts:87-101` |
| ORG-12, ORG-13 (OWNER grants ADMIN) | `networking.test.ts:102-103` |
| ORG-12 (EDITOR denied) | `networking.test.ts:97` |
| ORG-16 (OWNER can't leave) | `networking.test.ts:98` |
| ORG-20 | `networking.test.ts:94-95` |
| OPP-08, OPP-10 (org) | `collaboration.test.ts:153-160` |
| PRJ-01 | `collaboration.test.ts:138-140`; `tests/e2e/scenario-ab-e.spec.ts:71-72` |
| PRJ-02 | `collaboration.test.ts:119-120`; `tests/e2e/security.spec.ts:27-29` |
| PRJ-06 (MBR) | `tests/e2e/security.spec.ts:36-38` |
| PRJ-07 | `collaboration.test.ts:129,134` |
| PRJ-10 | `collaboration.test.ts:136` |
| PRJ-14 | `collaboration.test.ts:130,137` |
| PRJ-19 (ADMIN vs OWNER) | `networking.test.ts:119` |
| PRJ-22 | `networking.test.ts:117-118` |
| PRJ-25 | `social.test.ts:91-92`; `networking.test.ts:114` (delegated) |
| PRJ-27 | `collaboration.test.ts:116-117` |
| PRJ-28 | `social.test.ts:62-64` |
| PRJ-29, PSH-01, PSH-05 | `collaboration.test.ts:191-195`; `tests/e2e/scenario-cg.spec.ts:82-96` |
| OPP-01 | `tests/e2e/scenario-ab-e.spec.ts:52-58` |
| OPP-02 (draft not listed) | `collaboration.test.ts:121` |
| OPP-08 | `collaboration.test.ts:63,109,118,121` |
| OPP-09 | `collaboration.test.ts:51,99` |
| OPP-13 | `collaboration.test.ts:103,107` |
| OPP-14 | `collaboration.test.ts:74-76` |
| OPP-17 | `collaboration.test.ts:105` |
| OPP-23 | `collaboration.test.ts:55` |
| PROF-12 | `collaboration.test.ts:70-71` |
| APP-01, APP-06, APP-08, APP-09, APP-10 | `collaboration.test.ts:74-93`; `tests/e2e/scenario-ab-e.spec.ts:58-72` |
| APP-02, APP-03, APP-12 | `collaboration.test.ts:162-166`; `tests/e2e/scenario-cg.spec.ts:40-43` |
| APP-04, APP-05 | `collaboration.test.ts:100-102` |
| POST-06, POST-13, POST-10, POST-12 | `social.test.ts:92-124` |
| POST-16 | `social.test.ts:127-141` |
| POST-17 (tag page) | `tests/e2e/scenario-df.spec.ts:52-53` |
| CMT-01, CMT-02 | `social.test.ts:103-110` |
| CMT-04 | `social.test.ts:107-109` |
| POST-14 | `social.test.ts:119-120` |
| FOL-01, FOL-02, FOL-03, FOL-04 | `social.test.ts:51-65` |
| CON-01..CON-05 | `social.test.ts:20-49` |
| BLK-01 | `social.test.ts:67-79`; `networking.test.ts:42` |
| MSG-01, MSG-02 | `networking.test.ts:21-27`; `collaboration.test.ts:162-168` |
| MSG-04 | `networking.test.ts:34-40` |
| MSG-05 (BLK) | `networking.test.ts:42-44` |
| NTF-01, NTF-03 | `networking.test.ts:61,70` |
| AUTH-05, AUTH-21 | `networking.test.ts:55-75` |
| MOD-01, MOD-04 | `social.test.ts:143-153` |
| MED-01 (CSRF) | `tests/e2e/security.spec.ts:41-44` |
| Proxy redirect (401 cells of member pages) | `tests/e2e/security.spec.ts:5-10` |

### Rows with no test

AUTH-03, AUTH-11, AUTH-12, AUTH-13, AUTH-18, AUTH-19, AUTH-20, AUTH-22;
PROF-02, PROF-05, PROF-06, PROF-07, PROF-08, PROF-09, PROF-11, PROF-13, PROF-14;
ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06, ORG-07, ORG-08, ORG-11, ORG-14, ORG-15, ORG-17, ORG-18, ORG-19, ORG-21, ORG-22, ORG-23, ORG-24, ORG-25, ORG-26;
PRJ-03, PRJ-04, PRJ-05, PRJ-08, PRJ-09, PRJ-11, PRJ-12, PRJ-13, PRJ-15, PRJ-16, PRJ-17, PRJ-18, PRJ-20, PRJ-21, PRJ-23, PRJ-24, PRJ-26, PRJ-30, PRJ-31;
OPP-03, OPP-04, OPP-05, OPP-06, OPP-07, OPP-11, OPP-12, OPP-15, OPP-16, OPP-18, OPP-19, OPP-20, OPP-21, OPP-22, OPP-24;
APP-07, APP-11, APP-13;
POST-01 (ANON/BLK cells), POST-02, POST-03, POST-04, POST-05, POST-07 (org/project denial beyond one case), POST-08, POST-09, POST-11, POST-15, POST-18;
CMT-03, CMT-05;
FOL-05;
BLK-02, BLK-03, BLK-04;
MSG-03, MSG-06, MSG-07, MSG-08;
NTF-02, NTF-04, NTF-05, NTF-06;
PSH-02, PSH-03, PSH-04, PSH-06, PSH-07, PSH-08, PSH-09;
INV-01 (blocked/inactive invitee), INV-03, INV-04, INV-06, INV-07;
MOD-02, MOD-03, MOD-05, MOD-06, MOD-07, MOD-08, MOD-09, MOD-10, MOD-11, MOD-12;
MED-02, MED-03; AUD-01, AUD-02; EP-01..EP-04;
all of §20 (cross-surface block / private / members-only / inactive rules) except the rows noted above.

Suggested order for the table-driven suite: (1) every `A*`/`NE` cell (they pin the findings), (2) the role-ladder rows ORG-07..ORG-19 and PRJ-07..PRJ-24 across all eight subjects including delegated roles, (3) the §20 surface tables parameterized by surface, (4) IDOR rows (each id-based action called by a non-owner).
