import "server-only";
import { MATCH_THRESHOLDS } from "@/config/matching";
import { scoreMatch, type MatchOpportunity, type MatchPerson, type MatchResult } from "@/lib/matching-engine";
import { db } from "./db";
import { blockedUserIds } from "./authz";
import { connectionIds } from "./social/graph";
import { notify } from "./notifications";
import { opportunityCardSelect, userCardSelect } from "./selects";
import { publicOpportunityWhere } from "./opportunity-visibility";

const personSelect = {
  id: true,
  username: true,
  skills: { select: { kind: true, tag: { select: { slug: true, name: true } } } },
  profile: {
    select: {
      displayName: true, headline: true, avatarKey: true, avatarArt: true, location: true, showLocation: true,
      availability: true, preferredCollabs: true, preferredWorkModes: true, experienceLevel: true,
    },
  },
} as const;

type PersonRow = { skills: { kind: string; tag: { slug: string; name: string } }[]; profile: { location: string | null; availability: MatchPerson["availability"]; preferredCollabs: MatchPerson["preferredCollabs"]; preferredWorkModes: MatchPerson["preferredWorkModes"]; experienceLevel: MatchPerson["experienceLevel"] } | null };

function toPerson(u: PersonRow): MatchPerson {
  return {
    skills: u.skills.filter((s) => s.kind === "SKILL").map((s) => s.tag),
    interests: u.skills.filter((s) => s.kind === "INTEREST").map((s) => s.tag),
    availability: u.profile?.availability ?? [],
    preferredCollabs: u.profile?.preferredCollabs ?? [],
    preferredWorkModes: u.profile?.preferredWorkModes ?? [],
    experienceLevel: u.profile?.experienceLevel ?? null,
    location: u.profile?.location ?? null,
  };
}

type OppRow = {
  collaborationType: MatchOpportunity["collaborationType"];
  workMode: MatchOpportunity["workMode"];
  experienceLevel: MatchOpportunity["experienceLevel"];
  location: string | null;
  tags: { kind: string; tag: { slug: string; name: string } }[];
};

function toOpportunity(o: OppRow): MatchOpportunity {
  return {
    skills: o.tags.filter((t) => t.kind === "SKILL").map((t) => t.tag),
    topics: o.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag),
    collaborationType: o.collaborationType,
    workMode: o.workMode,
    experienceLevel: o.experienceLevel,
    location: o.location,
  };
}

async function loadPerson(userId: string) {
  return db.user.findUnique({ where: { id: userId }, select: personSelect });
}

export async function explainMatch(userId: string, opportunityId: string): Promise<MatchResult | null> {
  const [person, opp] = await Promise.all([
    loadPerson(userId),
    db.opportunity.findUnique({ where: { id: opportunityId }, select: { collaborationType: true, workMode: true, experienceLevel: true, location: true, tags: { select: { kind: true, tag: { select: { slug: true, name: true } } } } } }),
  ]);
  if (!person || !opp) return null;
  return scoreMatch(toPerson(person), toOpportunity(opp));
}

/** Open opportunities ranked for a member, with the reasons behind each score. */
export async function recommendOpportunities(userId: string, take = 5) {
  const person = await loadPerson(userId);
  if (!person) return [];
  const tagIds = await db.userTag.findMany({ where: { userId }, select: { tagId: true } });
  const [blocked, applied] = await Promise.all([
    blockedUserIds(userId),
    db.application.findMany({ where: { applicantId: userId }, select: { opportunityId: true } }),
  ]);
  const candidates = await db.opportunity.findMany({
    where: {
      AND: [
        publicOpportunityWhere(),
        { id: { notIn: applied.map((a) => a.opportunityId) } },
        { NOT: { createdById: userId } },
        { NOT: { project: { members: { some: { userId } } } } },
        { NOT: { organization: { members: { some: { userId } } } } },
        blocked.length ? { NOT: { createdById: { in: blocked } } } : {},
        tagIds.length ? { tags: { some: { tagId: { in: tagIds.map((t) => t.tagId) } } } } : {},
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: opportunityCardSelect,
  });
  const p = toPerson(person);
  return candidates
    .map((o) => ({ opportunity: o, match: scoreMatch(p, toOpportunity(o)) }))
    .filter((r) => r.match.score >= MATCH_THRESHOLDS.recommend)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, take);
}

/** People who fit an opportunity (shown to whoever manages it). */
export async function recommendCandidates(opportunityId: string, excludeUserIds: string[] = [], take = 10) {
  const opp = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      collaborationType: true, workMode: true, experienceLevel: true, location: true, projectId: true, organizationId: true, createdById: true,
      tags: { select: { kind: true, tagId: true, tag: { select: { slug: true, name: true } } } },
      applications: { select: { applicantId: true } },
    },
  });
  if (!opp) return [];
  const tagIds = opp.tags.map((t) => t.tagId);
  if (tagIds.length === 0) return [];
  const teamIds = opp.projectId
    ? (await db.projectMember.findMany({ where: { projectId: opp.projectId }, select: { userId: true } })).map((m) => m.userId)
    : opp.organizationId
      ? (await db.organizationMember.findMany({ where: { organizationId: opp.organizationId }, select: { userId: true } })).map((m) => m.userId)
      : [];
  const exclude = [...new Set([...excludeUserIds, ...teamIds, ...opp.applications.map((a) => a.applicantId), ...(opp.createdById ? [opp.createdById] : [])])];
  const candidates = await db.user.findMany({
    where: {
      id: { notIn: exclude },
      status: "ACTIVE",
      profile: { searchable: true, visibility: "PUBLIC" },
      skills: { some: { tagId: { in: tagIds } } },
    },
    take: 200,
    select: personSelect,
  });
  const o = toOpportunity(opp);
  return candidates
    .map((u) => ({ user: u, match: scoreMatch(toPerson(u), o) }))
    .filter((r) => r.match.score >= MATCH_THRESHOLDS.recommend && !r.user.profile?.availability.includes("UNAVAILABLE"))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, take);
}

/** Notifies the best-matching members when an opportunity is published. */
export async function notifyMatchingMembers(opportunityId: string, actorId: string) {
  const opp = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { title: true, project: { select: { name: true } }, organization: { select: { name: true } } },
  });
  if (!opp) return 0;
  const blocked = await blockedUserIds(actorId);
  const matches = await recommendCandidates(opportunityId, [actorId, ...blocked], MATCH_THRESHOLDS.maxNotified);
  const owner = opp.project?.name ?? opp.organization?.name;
  let sent = 0;
  for (const m of matches) {
    if (m.match.score < MATCH_THRESHOLDS.notify) continue;
    await notify({
      userId: m.user.id,
      type: "OPPORTUNITY_MATCH",
      actorId,
      href: `/opportunities/${opportunityId}`,
      text: `New opportunity that fits your skills: ${opp.title}${owner ? ` (${owner})` : ""}.`,
    });
    sent++;
  }
  return sent;
}

/** "People you may know": mutual connections first, then shared skills and interests. */
export async function suggestPeople(userId: string, take = 6) {
  const [mine, blocked, pending, myTags] = await Promise.all([
    connectionIds(userId),
    blockedUserIds(userId),
    db.connection.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } }),
    db.userTag.findMany({ where: { userId }, select: { tagId: true } }),
  ]);
  const exclude = new Set([userId, ...mine, ...blocked, ...pending.flatMap((p) => [p.userAId, p.userBId])]);
  const score = new Map<string, { mutual: number; shared: number }>();

  if (mine.length) {
    const second = await db.connection.findMany({
      where: { status: "ACCEPTED", OR: [{ userAId: { in: mine } }, { userBId: { in: mine } }] },
      select: { userAId: true, userBId: true },
      take: 2000,
    });
    const mineSet = new Set(mine);
    for (const c of second) {
      const other = mineSet.has(c.userAId) ? c.userBId : c.userAId;
      if (exclude.has(other)) continue;
      const s = score.get(other) ?? { mutual: 0, shared: 0 };
      s.mutual++;
      score.set(other, s);
    }
  }
  if (myTags.length) {
    const shared = await db.userTag.groupBy({
      by: ["userId"],
      where: { tagId: { in: myTags.map((t) => t.tagId) }, userId: { notIn: [...exclude] } },
      _count: { tagId: true },
      orderBy: { _count: { tagId: "desc" } },
      take: 100,
    });
    for (const r of shared) {
      const s = score.get(r.userId) ?? { mutual: 0, shared: 0 };
      s.shared = r._count.tagId;
      score.set(r.userId, s);
    }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].mutual * 3 + b[1].shared - (a[1].mutual * 3 + a[1].shared)).slice(0, 40);
  if (ranked.length === 0) return [];
  const users = await db.user.findMany({
    where: { id: { in: ranked.map(([id]) => id) }, status: "ACTIVE", profile: { searchable: true } },
    select: userCardSelect,
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ranked
    .filter(([id]) => byId.has(id))
    .slice(0, take)
    .map(([id, s]) => ({
      user: byId.get(id)!,
      reason: s.mutual > 0 ? `${s.mutual} mutual connection${s.mutual === 1 ? "" : "s"}` : `${s.shared} shared skill${s.shared === 1 ? "" : "s"} or interest${s.shared === 1 ? "" : "s"}`,
    }));
}
