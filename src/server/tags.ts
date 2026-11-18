import "server-only";
import type { OpportunityTagKind, ProjectTagKind, TagCategory, UserTagKind } from "@/generated/prisma/enums";
import { tagDisplayName, tagSlug } from "@/lib/tags";
import { db, type Tx } from "./db";

const TECH = new Set([
  "python", "java", "csharp", "cpp", "javascript", "typescript", "react", "next-js", "node-js", "go", "rust",
  "postgresql", "kubernetes", "docker", "aws", "flutter", "swift", "kotlin", "vue", "angular", "django", "rails",
  "php", "unity", "unreal", "tensorflow", "pytorch", "solidity", "graphql", "tailwind", "figma",
]);
const ROLE = new Set(["frontend", "backend", "fullstack", "devops", "ui-ux", "design", "product-management", "data-science"]);

function guessCategory(slug: string): TagCategory {
  if (TECH.has(slug)) return "TECHNOLOGY";
  if (ROLE.has(slug)) return "ROLE";
  return "OTHER";
}

export type TagRef = { id: string; slug: string; name: string };

/** Normalizes names to slugs and returns tag rows, creating missing tags. */
export async function upsertTags(names: string[], tx: Tx = db): Promise<TagRef[]> {
  const bySlug = new Map<string, string>();
  for (const n of names) {
    const slug = tagSlug(n);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, tagDisplayName(n));
  }
  if (bySlug.size === 0) return [];
  const slugs = [...bySlug.keys()];
  const existing = await tx.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true } });
  const have = new Set(existing.map((t) => t.slug));
  const missing = slugs.filter((s) => !have.has(s));
  if (missing.length) {
    await tx.tag.createMany({
      data: missing.map((slug) => ({ slug, name: bySlug.get(slug)!, category: guessCategory(slug) })),
      skipDuplicates: true,
    });
  }
  const all = await tx.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true } });
  // Keep the caller's order.
  return slugs.map((s) => all.find((t) => t.slug === s)!).filter(Boolean);
}

/** Recomputes usage counters for the given tags across every entity type. */
export async function refreshTagUsage(tagIds: string[], tx: Tx = db) {
  if (tagIds.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Tag" t SET "usageCount" =
      (SELECT count(*) FROM "UserTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "ProjectTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "OrganizationTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "OpportunityTag" x WHERE x."tagId" = t.id) +
      (SELECT count(*) FROM "PostTag" x WHERE x."tagId" = t.id)
    WHERE t.id = ANY(${tagIds})`;
}

export async function setUserTags(userId: string, kind: UserTagKind, names: string[], tx: Tx = db) {
  const before = await tx.userTag.findMany({ where: { userId, kind }, select: { tagId: true } });
  const tags = await upsertTags(names, tx);
  await tx.userTag.deleteMany({ where: { userId, kind } });
  if (tags.length) await tx.userTag.createMany({ data: tags.map((t) => ({ userId, tagId: t.id, kind })), skipDuplicates: true });
  await refreshTagUsage([...new Set([...before.map((b) => b.tagId), ...tags.map((t) => t.id)])], tx);
}

export async function setProjectTags(projectId: string, kind: ProjectTagKind, names: string[], tx: Tx = db) {
  const before = await tx.projectTag.findMany({ where: { projectId, kind }, select: { tagId: true } });
  const tags = await upsertTags(names, tx);
  await tx.projectTag.deleteMany({ where: { projectId, kind } });
  if (tags.length) await tx.projectTag.createMany({ data: tags.map((t) => ({ projectId, tagId: t.id, kind })), skipDuplicates: true });
  await refreshTagUsage([...new Set([...before.map((b) => b.tagId), ...tags.map((t) => t.id)])], tx);
}

export async function setOrganizationTags(organizationId: string, names: string[], tx: Tx = db) {
  const before = await tx.organizationTag.findMany({ where: { organizationId }, select: { tagId: true } });
  const tags = await upsertTags(names, tx);
  await tx.organizationTag.deleteMany({ where: { organizationId } });
  if (tags.length) await tx.organizationTag.createMany({ data: tags.map((t) => ({ organizationId, tagId: t.id })), skipDuplicates: true });
  await refreshTagUsage([...new Set([...before.map((b) => b.tagId), ...tags.map((t) => t.id)])], tx);
}

export async function setOpportunityTags(opportunityId: string, kind: OpportunityTagKind, names: string[], tx: Tx = db) {
  const before = await tx.opportunityTag.findMany({ where: { opportunityId, kind }, select: { tagId: true } });
  const tags = await upsertTags(names, tx);
  await tx.opportunityTag.deleteMany({ where: { opportunityId, kind } });
  if (tags.length) await tx.opportunityTag.createMany({ data: tags.map((t) => ({ opportunityId, tagId: t.id, kind })), skipDuplicates: true });
  await refreshTagUsage([...new Set([...before.map((b) => b.tagId), ...tags.map((t) => t.id)])], tx);
}

export async function setPostTags(postId: string, names: string[], tx: Tx = db) {
  const tags = await upsertTags(names, tx);
  if (tags.length) await tx.postTag.createMany({ data: tags.map((t) => ({ postId, tagId: t.id })), skipDuplicates: true });
  await refreshTagUsage(tags.map((t) => t.id), tx);
}

/** Autocomplete: prefix matches first, then substring matches, most-used first. */
export async function suggestTags(query: string, limit = 8) {
  const q = query.trim();
  if (!q) return popularTags(limit);
  const slug = tagSlug(q);
  const rows = await db.tag.findMany({
    where: {
      OR: [
        { slug: { startsWith: slug } },
        { name: { contains: q, mode: "insensitive" } },
        ...(slug ? [{ slug: { contains: slug } }] : []),
      ],
    },
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    take: 30,
    select: { slug: true, name: true, usageCount: true },
  });
  rows.sort((a, b) => Number(b.slug.startsWith(slug)) - Number(a.slug.startsWith(slug)) || b.usageCount - a.usageCount);
  return rows.slice(0, limit);
}

export async function popularTags(limit = 12) {
  return db.tag.findMany({
    where: { usageCount: { gt: 0 } },
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    take: limit,
    select: { slug: true, name: true, usageCount: true },
  });
}

export async function getTagBySlug(slug: string) {
  return db.tag.findUnique({ where: { slug: tagSlug(slug) }, select: { id: true, slug: true, name: true, usageCount: true } });
}
