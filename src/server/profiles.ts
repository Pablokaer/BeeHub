import "server-only";
import type { z } from "zod";
import type { educationSchema, experienceSchema, privacySchema, profileSchema } from "@/lib/validation";
import { db } from "./db";
import { NotFoundError, ValidationError } from "./errors";
import { isArtId } from "@/lib/art-catalog";
import { ART_CONFLICT_MESSAGE } from "@/lib/validation";
import { isBlockedEitherWay } from "./authz";
import { setUserTags } from "./tags";
import { assertOwnedMedia } from "./uploads";
import { connectionCount, followerCount, followingCount, mutualConnections, relationship } from "./social/graph";
import type { Actor, Viewer } from "./auth/types";

export type ProfileLink = { label: string; url: string };

/**
 * Public profile view. Applies privacy settings server-side: hidden fields are never
 * sent to the client, blocked/inactive users resolve to "not found".
 */
export async function getPublicProfile(viewer: Viewer | null, username: string) {
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, status: true, createdAt: true,
      profile: true,
      skills: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
      experiences: { orderBy: [{ startDate: "desc" }], include: { organization: { select: { slug: true, name: true } } } },
      educations: { orderBy: [{ endYear: "desc" }, { startYear: "desc" }] },
    },
  });
  if (!user || user.status !== "ACTIVE" || !user.profile) return null;
  if (viewer && (await isBlockedEitherWay(viewer.id, user.id))) return null;
  const isSelf = viewer?.id === user.id;
  const p = user.profile;
  if (p.visibility === "MEMBERS" && !viewer) return { restricted: true as const, username: user.username, displayName: p.displayName, avatarKey: p.avatarKey, avatarArt: p.avatarArt };

  const rel = await relationship(viewer?.id, user.id);
  const connected = rel.connection === "ACCEPTED";
  const canSeeConnections = isSelf || p.connectionsVisible === "EVERYONE" || (p.connectionsVisible === "CONNECTIONS" && connected);

  const [projects, orgs, counts, mutual] = await Promise.all([
    db.projectMember.findMany({
      where: {
        userId: user.id,
        project: { status: "ACTIVE", ...(isSelf ? {} : { visibility: "PUBLIC" }) },
      },
      orderBy: { joinedAt: "desc" },
      select: {
        role: true, title: true,
        project: { select: { id: true, slug: true, name: true, summary: true, logoKey: true, coverKey: true, stage: true, category: true, createdById: true, visibility: true } },
      },
    }),
    db.organizationMember.findMany({
      where: { userId: user.id, organization: { status: "ACTIVE" } },
      select: { role: true, title: true, organization: { select: { id: true, slug: true, name: true, logoKey: true, type: true } } },
    }),
    Promise.all([
      canSeeConnections ? connectionCount(user.id) : Promise.resolve(null),
      followerCount({ userId: user.id }),
      followingCount(user.id),
    ]),
    viewer && !isSelf ? mutualConnections(viewer.id, user.id, 3) : Promise.resolve({ count: 0, users: [] }),
  ]);

  return {
    restricted: false as const,
    id: user.id,
    username: user.username,
    memberSince: user.createdAt,
    isSelf,
    relationship: rel,
    displayName: p.displayName,
    headline: p.headline,
    bio: p.bio,
    location: isSelf || p.showLocation ? p.location : null,
    avatarKey: p.avatarKey,
    coverKey: p.coverKey,
    avatarArt: p.avatarArt,
    coverArt: p.coverArt,
    languages: p.languages,
    links: (Array.isArray(p.links) ? p.links : []) as ProfileLink[],
    availability: p.availability,
    experienceLevel: p.experienceLevel,
    preferredWorkModes: p.preferredWorkModes,
    preferredCollabs: p.preferredCollabs,
    messagePermission: p.messagePermission,
    skills: user.skills.filter((s) => s.kind === "SKILL").map((s) => s.tag),
    interests: user.skills.filter((s) => s.kind === "INTEREST").map((s) => s.tag),
    experiences: user.experiences,
    educations: user.educations,
    projectsCreated: projects.filter((m) => m.project.createdById === user.id || m.role === "OWNER"),
    projectsParticipating: projects.filter((m) => m.project.createdById !== user.id && m.role !== "OWNER"),
    organizations: orgs,
    connectionCount: counts[0],
    followerCount: counts[1],
    followingCount: counts[2],
    mutual,
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/**
 * Compact card for the signed-in member's own profile (feed and profile rails): identity,
 * cover/avatar sources and network counts. Own counts are always visible to their owner.
 */
export async function getOwnProfileCard(actor: Actor) {
  const [profile, connections, followers, following] = await Promise.all([
    db.profile.findUnique({
      where: { userId: actor.id },
      select: { displayName: true, headline: true, avatarKey: true, avatarArt: true, coverKey: true, coverArt: true },
    }),
    connectionCount(actor.id),
    followerCount({ userId: actor.id }),
    followingCount(actor.id),
  ]);
  if (!profile) throw new NotFoundError();
  return { username: actor.username, ...profile, connections, followers, following };
}

export async function getProfileForEdit(actor: Actor) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: {
      username: true,
      profile: true,
      skills: { select: { kind: true, tag: { select: { name: true } } } },
      experiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: [{ endYear: "desc" }] },
    },
  });
  if (!user?.profile) throw new NotFoundError();
  return {
    username: user.username,
    profile: user.profile,
    links: (Array.isArray(user.profile.links) ? user.profile.links : []) as ProfileLink[],
    skills: user.skills.filter((s) => s.kind === "SKILL").map((s) => s.tag.name),
    interests: user.skills.filter((s) => s.kind === "INTEREST").map((s) => s.tag.name),
    experiences: user.experiences,
    educations: user.educations,
  };
}

/** Re-checks catalog choices in the service, so callers that skip the form schema get the same rules. */
function assertProfileArt(input: Pick<z.infer<typeof profileSchema>, "avatarKey" | "avatarArt" | "coverKey" | "coverArt">) {
  const errors: Record<string, string> = {};
  if (input.avatarArt && !isArtId("avatar", input.avatarArt)) errors.avatarArt = "Choose an avatar from the illustration catalog";
  if (input.coverArt && !isArtId("cover", input.coverArt)) errors.coverArt = "Choose a cover from the illustration catalog";
  if (input.avatarKey && input.avatarArt) errors.avatarArt = ART_CONFLICT_MESSAGE;
  if (input.coverKey && input.coverArt) errors.coverArt = ART_CONFLICT_MESSAGE;
  if (Object.keys(errors).length > 0) throw new ValidationError(Object.values(errors)[0], errors);
}

export async function updateProfile(actor: Actor, input: z.infer<typeof profileSchema>) {
  assertProfileArt(input);
  const current = await db.profile.findUnique({ where: { userId: actor.id }, select: { avatarKey: true, avatarArt: true, coverKey: true } });
  // Unchanged keys are kept as-is; newly referenced keys must be the actor's own uploads.
  await assertOwnedMedia(actor, [input.avatarKey, input.coverKey].filter((k) => k && k !== current?.avatarKey && k !== current?.coverKey));
  // Availability "Unavailable" is exclusive.
  const availability = input.availability.includes("UNAVAILABLE") ? ["UNAVAILABLE" as const] : input.availability;
  await db.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId: actor.id },
      data: {
        displayName: input.displayName,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        location: input.location ?? null,
        languages: [...new Set(input.languages)],
        links: input.links,
        availability,
        experienceLevel: input.experienceLevel ?? null,
        preferredWorkModes: input.preferredWorkModes,
        preferredCollabs: input.preferredCollabs,
        avatarKey: input.avatarKey ?? null,
        coverKey: input.coverKey ?? null,
        avatarArt: input.avatarArt ?? null,
        coverArt: input.coverArt ?? null,
      },
    });
    await setUserTags(actor.id, "SKILL", input.skills, tx);
    await setUserTags(actor.id, "INTEREST", input.interests, tx);
  });
}

export async function updatePrivacy(actor: Actor, input: z.infer<typeof privacySchema>) {
  await db.profile.update({ where: { userId: actor.id }, data: input });
  if (!input.followApproval) {
    // Turning approval off accepts pending follow requests.
    await db.follow.updateMany({ where: { userId: actor.id, status: "PENDING" }, data: { status: "ACTIVE" } });
  }
}

export async function upsertExperience(actor: Actor, input: z.infer<typeof experienceSchema>) {
  const data = {
    title: input.title,
    company: input.company,
    location: input.location ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    description: input.description ?? null,
  };
  if (input.id) {
    const res = await db.experience.updateMany({ where: { id: input.id, userId: actor.id }, data });
    if (res.count === 0) throw new NotFoundError();
  } else {
    const count = await db.experience.count({ where: { userId: actor.id } });
    if (count >= 30) throw new NotFoundError("You can add up to 30 experiences.");
    await db.experience.create({ data: { ...data, userId: actor.id } });
  }
}

export async function deleteExperience(actor: Actor, id: string) {
  await db.experience.deleteMany({ where: { id, userId: actor.id } });
}

export async function upsertEducation(actor: Actor, input: z.infer<typeof educationSchema>) {
  const data = {
    school: input.school,
    degree: input.degree ?? null,
    field: input.field ?? null,
    startYear: input.startYear ?? null,
    endYear: input.endYear ?? null,
    description: input.description ?? null,
  };
  if (input.id) {
    const res = await db.education.updateMany({ where: { id: input.id, userId: actor.id }, data });
    if (res.count === 0) throw new NotFoundError();
  } else {
    const count = await db.education.count({ where: { userId: actor.id } });
    if (count >= 20) throw new NotFoundError("You can add up to 20 entries.");
    await db.education.create({ data: { ...data, userId: actor.id } });
  }
}

export async function deleteEducation(actor: Actor, id: string) {
  await db.education.deleteMany({ where: { id, userId: actor.id } });
}

export async function getPrivacySettings(actor: Actor) {
  const p = await db.profile.findUnique({
    where: { userId: actor.id },
    select: { visibility: true, showLocation: true, connectionsVisible: true, messagePermission: true, followApproval: true, searchable: true },
  });
  if (!p) throw new NotFoundError();
  return p;
}

/** Profile completeness drives the onboarding checklist on the feed. */
export async function profileCompleteness(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      emailVerifiedAt: true,
      profile: { select: { headline: true, bio: true, avatarKey: true, avatarArt: true, availability: true } },
      _count: { select: { skills: true, projectMemberships: true } },
    },
  });
  if (!u) return null;
  const steps = [
    { key: "verify", label: "Verify your email", done: !!u.emailVerifiedAt, href: "/settings/account" },
    { key: "headline", label: "Add a headline", done: !!u.profile?.headline, href: "/profile/edit" },
    { key: "skills", label: "Add your skills", done: u._count.skills > 0, href: "/profile/edit#skills" },
    { key: "availability", label: "Share your availability", done: (u.profile?.availability.length ?? 0) > 0, href: "/profile/edit#availability" },
    { key: "avatar", label: "Add a profile picture", done: !!(u.profile?.avatarKey || u.profile?.avatarArt), href: "/profile/edit" },
    { key: "project", label: "Create or join a project", done: u._count.projectMemberships > 0, href: "/projects/new" },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}
