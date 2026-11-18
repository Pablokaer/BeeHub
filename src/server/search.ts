import "server-only";
import { isPositionId, positionIdsMatchingText } from "@/lib/positions";
import type { Prisma } from "@/generated/prisma/client";
import type {
  Availability,
  CollaborationType,
  ExperienceLevel,
  OpportunityCategory,
  OrgSize,
  OrgType,
  ProjectCategory,
  ProjectStage,
  WorkMode,
} from "@/generated/prisma/enums";
import { PAGE_SIZE } from "@/lib/constants";
import { tagSlug } from "@/lib/tags";
import { scoreMatch, type MatchResult } from "@/lib/matching-engine";
import { db } from "./db";
import { blockedUserIds } from "./authz";
import { publicOpportunityWhere } from "./opportunity-visibility";
import { hydratePosts, postSelect, visiblePostWhere } from "./posts";
import { opportunityCardSelect, orgCardSelect, projectCardSelect, userCardSelect } from "./selects";
import type { Viewer } from "./auth/types";

/**
 * Discovery search across people, projects, organizations, opportunities and posts.
 * Free text is split into terms; every term must match a name/description field or a
 * tag (AND of ORs). Text columns are backed by pg_trgm GIN indexes, so ILIKE stays fast.
 * Private data (hidden profiles, private projects, hidden locations) is filtered here.
 */

export function terms(q: string | undefined) {
  if (!q) return [];
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[%_\\]/g, "").trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);
}

const tagMatch = (t: string) => ({ tag: { OR: [{ name: { contains: t, mode: "insensitive" as const } }, { slug: { startsWith: tagSlug(t) || t.toLowerCase() } }] } });

function slugs(list: string[] | undefined) {
  return [...new Set((list ?? []).map(tagSlug).filter(Boolean))];
}

export type Page<T> = { items: T[]; total: number; page: number; pageCount: number };

function paged(page: number | undefined) {
  const p = Math.max(1, Math.min(500, page ?? 1));
  return { page: p, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

function pageOf<T>(items: T[], total: number, page: number): Page<T> {
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ───────────── People ─────────────

export type PeopleFilters = {
  q?: string;
  skills?: string[];
  interests?: string[];
  location?: string;
  availability?: Availability[];
  experience?: ExperienceLevel[];
  language?: string;
  page?: number;
};

export async function searchPeople(viewer: Viewer | null, f: PeopleFilters) {
  const { page, skip, take } = paged(f.page);
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const and: Prisma.UserWhereInput[] = [
    { status: "ACTIVE" },
    { profile: { searchable: true, ...(viewer ? {} : { visibility: "PUBLIC" }) } },
  ];
  if (blocked.length) and.push({ id: { notIn: blocked } });
  for (const t of terms(f.q)) {
    and.push({
      OR: [
        { username: { contains: t, mode: "insensitive" } },
        { profile: { displayName: { contains: t, mode: "insensitive" } } },
        { profile: { headline: { contains: t, mode: "insensitive" } } },
        { profile: { bio: { contains: t, mode: "insensitive" } } },
        { skills: { some: tagMatch(t) } },
      ],
    });
  }
  for (const s of slugs(f.skills)) and.push({ skills: { some: { kind: "SKILL", tag: { slug: s } } } });
  for (const s of slugs(f.interests)) and.push({ skills: { some: { kind: "INTEREST", tag: { slug: s } } } });
  if (f.location) and.push({ profile: { showLocation: true, location: { contains: f.location.trim(), mode: "insensitive" } } });
  if (f.availability?.length) and.push({ profile: { availability: { hasSome: f.availability } } });
  if (f.experience?.length) and.push({ profile: { experienceLevel: { in: f.experience } } });
  if (f.language) and.push({ profile: { languages: { has: f.language.trim() } } });
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ profile: { updatedAt: "desc" } }],
      skip,
      take,
      select: { ...userCardSelect, skills: { where: { kind: "SKILL" }, take: 6, select: { tag: { select: { slug: true, name: true } } } } },
    }),
  ]);
  return pageOf(rows, total, page);
}

// ───────────── Projects ─────────────

export type ProjectFilters = {
  q?: string;
  category?: ProjectCategory[];
  stage?: ProjectStage[];
  tech?: string[];
  tags?: string[];
  lookingFor?: string[]; // skills requested by the project's open opportunities
  collaborationType?: CollaborationType[];
  openOpportunities?: boolean;
  beginnerFriendly?: boolean;
  openSource?: boolean;
  sort?: "recent" | "new" | "name";
  page?: number;
};

export async function searchProjects(viewer: Viewer | null, f: ProjectFilters) {
  const { page, skip, take } = paged(f.page);
  const openOpp = publicOpportunityWhere();
  const and: Prisma.ProjectWhereInput[] = [{ status: "ACTIVE", visibility: "PUBLIC" }];
  for (const t of terms(f.q)) {
    and.push({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { summary: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
        { tags: { some: tagMatch(t) } },
      ],
    });
  }
  if (f.category?.length) and.push({ category: { in: f.category } });
  if (f.stage?.length) and.push({ stage: { in: f.stage } });
  for (const s of slugs(f.tech)) and.push({ tags: { some: { kind: "TECH", tag: { slug: s } } } });
  for (const s of slugs(f.tags)) and.push({ tags: { some: { tag: { slug: s } } } });
  const looking = slugs(f.lookingFor);
  if (looking.length) and.push({ opportunities: { some: { ...openOpp, tags: { some: { kind: "SKILL", tag: { slug: { in: looking } } } } } } });
  if (f.collaborationType?.length) and.push({ opportunities: { some: { ...openOpp, collaborationType: { in: f.collaborationType } } } });
  if (f.openOpportunities) and.push({ opportunities: { some: openOpp } });
  if (f.beginnerFriendly) and.push({ OR: [{ acceptsBeginners: true }, { opportunities: { some: { ...openOpp, experienceLevel: { in: ["BEGINNER", "JUNIOR"] } } } }] });
  if (f.openSource) and.push({ isOpenSource: true });
  const orderBy: Prisma.ProjectOrderByWithRelationInput = f.sort === "new" ? { createdAt: "desc" } : f.sort === "name" ? { name: "asc" } : { updatedAt: "desc" };
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        ...projectCardSelect,
        opportunities: { where: openOpp, take: 3, orderBy: { publishedAt: "desc" }, select: { id: true, title: true } },
      },
    }),
  ]);
  return pageOf(rows, total, page);
}

// ───────────── Organizations ─────────────

export type OrgFilters = { q?: string; type?: OrgType[]; size?: OrgSize[]; industry?: string; location?: string; tags?: string[]; page?: number };

export async function searchOrganizations(f: OrgFilters) {
  const { page, skip, take } = paged(f.page);
  const and: Prisma.OrganizationWhereInput[] = [{ status: "ACTIVE" }];
  for (const t of terms(f.q)) {
    and.push({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { tagline: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
        { industry: { contains: t, mode: "insensitive" } },
        { tags: { some: tagMatch(t) } },
      ],
    });
  }
  if (f.type?.length) and.push({ type: { in: f.type } });
  if (f.size?.length) and.push({ size: { in: f.size } });
  if (f.industry) and.push({ industry: { contains: f.industry.trim(), mode: "insensitive" } });
  if (f.location) and.push({ location: { contains: f.location.trim(), mode: "insensitive" } });
  for (const s of slugs(f.tags)) and.push({ tags: { some: { tag: { slug: s } } } });
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take, select: orgCardSelect }),
  ]);
  return pageOf(rows, total, page);
}

// ───────────── Opportunities ─────────────

export type OpportunityFilters = {
  q?: string;
  /** Position ids from the catalog (any of). Unknown ids are ignored. */
  position?: string[];
  skills?: string[];
  tags?: string[];
  category?: OpportunityCategory[];
  collaborationType?: CollaborationType[];
  workMode?: WorkMode[];
  experience?: ExperienceLevel[];
  paid?: boolean;
  owner?: "project" | "org" | "person";
  location?: string;
  sort?: "recent" | "deadline" | "match";
  page?: number;
};

export async function searchOpportunities(viewer: Viewer | null, f: OpportunityFilters) {
  const { page, skip, take } = paged(f.page);
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const and: Prisma.OpportunityWhereInput[] = [publicOpportunityWhere()];
  if (blocked.length) and.push({ OR: [{ createdById: null }, { createdById: { notIn: blocked } }] });
  for (const t of terms(f.q)) {
    and.push({
      OR: [
        { title: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
        { tags: { some: tagMatch(t) } },
        ...(positionIdsMatchingText(t).length ? [{ position: { in: positionIdsMatchingText(t) } }] : []),
        { project: { name: { contains: t, mode: "insensitive" } } },
        { organization: { name: { contains: t, mode: "insensitive" } } },
      ],
    });
  }
  const skillSlugs = slugs(f.skills);
  if (skillSlugs.length) and.push({ tags: { some: { kind: "SKILL", tag: { slug: { in: skillSlugs } } } } });
  for (const s of slugs(f.tags)) and.push({ tags: { some: { tag: { slug: s } } } });
  if (f.category?.length) and.push({ category: { in: f.category } });
  const positions = (f.position ?? []).filter(isPositionId);
  if (positions.length) and.push({ position: { in: positions } });
  if (f.collaborationType?.length) and.push({ collaborationType: { in: f.collaborationType } });
  if (f.workMode?.length) and.push({ workMode: { in: f.workMode } });
  if (f.experience?.length) and.push({ OR: [{ experienceLevel: { in: f.experience } }, { experienceLevel: null }] });
  if (f.paid === true) and.push({ isPaid: true });
  if (f.paid === false) and.push({ isPaid: false });
  if (f.owner === "project") and.push({ projectId: { not: null } });
  if (f.owner === "org") and.push({ organizationId: { not: null } });
  if (f.owner === "person") and.push({ projectId: null, organizationId: null });
  if (f.location) and.push({ location: { contains: f.location.trim(), mode: "insensitive" } });
  const where = { AND: and };
  const select = { ...opportunityCardSelect, description: true, duration: true, commitment: true, tags: { select: { kind: true, tag: { select: { slug: true, name: true } } } } } as const;

  if (f.sort === "match" && viewer) {
    const [person, rows] = await Promise.all([
      db.user.findUnique({
        where: { id: viewer.id },
        select: {
          skills: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
          profile: { select: { availability: true, preferredCollabs: true, preferredWorkModes: true, experienceLevel: true, location: true } },
        },
      }),
      db.opportunity.findMany({ where, orderBy: { publishedAt: "desc" }, take: 300, select }),
    ]);
    const p = {
      skills: person?.skills.filter((s) => s.kind === "SKILL").map((s) => s.tag) ?? [],
      interests: person?.skills.filter((s) => s.kind === "INTEREST").map((s) => s.tag) ?? [],
      availability: person?.profile?.availability ?? [],
      preferredCollabs: person?.profile?.preferredCollabs ?? [],
      preferredWorkModes: person?.profile?.preferredWorkModes ?? [],
      experienceLevel: person?.profile?.experienceLevel ?? null,
      location: person?.profile?.location ?? null,
    };
    const scored = rows
      .map((o) => ({
        ...o,
        match: scoreMatch(p, {
          skills: o.tags.filter((t) => t.kind === "SKILL").map((t) => t.tag),
          topics: o.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag),
          collaborationType: o.collaborationType,
          workMode: o.workMode,
          experienceLevel: o.experienceLevel,
          location: o.location,
        }) as MatchResult | null,
      }))
      .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
    return pageOf(scored.slice(skip, skip + take), scored.length, page);
  }

  const orderBy: Prisma.OpportunityOrderByWithRelationInput[] =
    f.sort === "deadline" ? [{ deadline: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }] : [{ publishedAt: "desc" }];
  const [total, rows] = await Promise.all([db.opportunity.count({ where }), db.opportunity.findMany({ where, orderBy, skip, take, select })]);
  return pageOf(rows.map((r) => ({ ...r, match: null as MatchResult | null })), total, page);
}

// ───────────── Posts ─────────────

export async function searchPosts(viewer: Viewer | null, f: { q?: string; tag?: string; page?: number }) {
  const { page, skip, take } = paged(f.page);
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const and: Prisma.PostWhereInput[] = [visiblePostWhere(blocked), { repostOfId: null }];
  for (const t of terms(f.q)) and.push({ OR: [{ body: { contains: t, mode: "insensitive" } }, { tags: { some: tagMatch(t) } }] });
  if (f.tag) and.push({ tags: { some: { tag: { slug: tagSlug(f.tag) } } } });
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: postSelect }),
  ]);
  return pageOf(await hydratePosts(viewer, rows), total, page);
}

/** Small mixed result set for the global search dropdown / overview. */
export async function quickSearch(viewer: Viewer | null, q: string) {
  if (terms(q).length === 0) return { people: [], projects: [], organizations: [], opportunities: [] };
  const [people, projects, organizations, opportunities] = await Promise.all([
    searchPeople(viewer, { q }),
    searchProjects(viewer, { q }),
    searchOrganizations({ q }),
    searchOpportunities(viewer, { q }),
  ]);
  return {
    people: people.items.slice(0, 4),
    projects: projects.items.slice(0, 4),
    organizations: organizations.items.slice(0, 4),
    opportunities: opportunities.items.slice(0, 4),
    totals: { people: people.total, projects: projects.total, organizations: organizations.total, opportunities: opportunities.total },
  };
}
