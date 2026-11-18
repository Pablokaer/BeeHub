import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Shared Prisma `select` shapes for list/card views. They never include private fields. */

export const userCardSelect = {
  id: true,
  username: true,
  profile: { select: { displayName: true, headline: true, avatarKey: true, avatarArt: true, location: true, showLocation: true, availability: true } },
} as const;

export const projectCardSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  logoKey: true,
  stage: true,
  category: true,
  visibility: true,
  isOpenSource: true,
  acceptsBeginners: true,
  updatedAt: true,
  tags: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
  organization: { select: { slug: true, name: true } },
  _count: { select: { members: true, opportunities: { where: { status: "OPEN" as const } } } },
} as const;

export const orgCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  logoKey: true,
  type: true,
  industry: true,
  location: true,
  size: true,
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  _count: { select: { members: true, projects: true } },
} as const;

export const opportunityCardSelect = {
  id: true,
  title: true,
  category: true,
  collaborationType: true,
  workMode: true,
  location: true,
  experienceLevel: true,
  isPaid: true,
  compensationType: true,
  compensation: true,
  status: true,
  publishedAt: true,
  deadline: true,
  createdAt: true,
  tags: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
  project: { select: { id: true, slug: true, name: true, logoKey: true } },
  organization: { select: { id: true, slug: true, name: true, logoKey: true } },
  createdBy: { select: { id: true, username: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } },
  _count: { select: { applications: true } },
} as const;

export type OpportunityCardData = Prisma.OpportunityGetPayload<{ select: typeof opportunityCardSelect }>;
export type ProjectCardData = Prisma.ProjectGetPayload<{ select: typeof projectCardSelect }>;
export type OrgCardData = Prisma.OrganizationGetPayload<{ select: typeof orgCardSelect }>;
export type UserCardData = Prisma.UserGetPayload<{ select: typeof userCardSelect }>;
