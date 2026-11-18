import type { Availability, CollaborationType, ExperienceLevel, WorkMode } from "@/generated/prisma/enums";
import { MATCH_WEIGHTS, type MatchWeights } from "@/config/matching";
import { collaborationLabels, workModeLabels } from "./constants";

/** Pure, deterministic scoring – shared by server code and unit tests. */

export type TagLite = { slug: string; name: string };

export type MatchPerson = {
  skills: TagLite[];
  interests: TagLite[];
  availability: Availability[];
  preferredCollabs: CollaborationType[];
  preferredWorkModes: WorkMode[];
  experienceLevel: ExperienceLevel | null;
  location: string | null;
};

export type MatchOpportunity = {
  skills: TagLite[];
  topics: TagLite[];
  collaborationType: CollaborationType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel | null;
  location: string | null;
};

export type MatchReason = { factor: keyof MatchWeights; points: number; text: string; positive: boolean };
export type MatchResult = { score: number; reasons: MatchReason[] };

const LEVEL_RANK: Record<ExperienceLevel, number> = { BEGINNER: 0, JUNIOR: 1, MID: 2, SENIOR: 3, EXPERT: 4 };

/** Availability statuses that signal interest in each collaboration type. */
export const AVAILABILITY_FIT: Record<CollaborationType, Availability[]> = {
  PAID: ["OPEN_TO_PAID_WORK"],
  FREELANCE: ["OPEN_TO_PAID_WORK", "LOOKING_FOR_PROJECTS"],
  VOLUNTEER: ["OPEN_TO_VOLUNTEER"],
  PROJECT_PARTNERSHIP: ["OPEN_TO_COLLABORATE", "OPEN_TO_NETWORKING"],
  BUSINESS_PARTNERSHIP: ["OPEN_TO_COLLABORATE", "OPEN_TO_NETWORKING"],
  COFOUNDER: ["LOOKING_FOR_COFOUNDERS"],
  INTERNSHIP: ["LOOKING_FOR_PROJECTS", "OPEN_TO_PAID_WORK"],
  ACADEMIC: ["OPEN_TO_COLLABORATE", "LOOKING_FOR_PROJECTS"],
  MENTORSHIP: ["OPEN_TO_NETWORKING", "OPEN_TO_COLLABORATE"],
  SERVICE_EXCHANGE: ["OPEN_TO_COLLABORATE"],
};
const GENERIC_AVAILABILITY: Availability[] = ["OPEN_TO_COLLABORATE", "LOOKING_FOR_PROJECTS"];

function list(names: string[], max = 3) {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

function overlap(a: TagLite[], b: TagLite[]) {
  const set = new Set(b.map((t) => t.slug));
  const seen = new Set<string>();
  return a.filter((t) => set.has(t.slug) && !seen.has(t.slug) && seen.add(t.slug));
}

export function scoreMatch(person: MatchPerson, opp: MatchOpportunity, weights: MatchWeights = MATCH_WEIGHTS): MatchResult {
  const reasons: MatchReason[] = [];
  const add = (factor: keyof MatchWeights, fraction: number, text: string | null, positive = true) => {
    const points = Math.round(weights[factor] * Math.max(0, Math.min(1, fraction)) * 10) / 10;
    if (text) reasons.push({ factor, points, text, positive });
    return points;
  };
  let total = 0;

  // 1. Requested skills.
  if (opp.skills.length > 0) {
    const matched = overlap(opp.skills, person.skills);
    total += add(
      "requiredSkills",
      matched.length / opp.skills.length,
      matched.length > 0
        ? `Has ${matched.length} of ${opp.skills.length} requested skills: ${list(matched.map((t) => t.name))}`
        : `None of the requested skills (${list(opp.skills.map((t) => t.name))}) listed yet`,
      matched.length > 0,
    );
  }

  // 2. Topic tags vs the person's skills and interests.
  if (opp.topics.length > 0) {
    const matched = overlap(opp.topics, [...person.skills, ...person.interests]);
    total += add("topicTags", matched.length / Math.min(opp.topics.length, 3), matched.length ? `Works with ${list(matched.map((t) => t.name))}` : null);
  }

  // 3. Declared interests vs everything the opportunity is about.
  const interestHits = overlap(person.interests, [...opp.skills, ...opp.topics]);
  total += add("interests", interestHits.length / 2, interestHits.length ? `Interested in ${list(interestHits.map((t) => t.name))}` : null);

  // 4. Preferred collaboration types.
  if (person.preferredCollabs.length === 0) total += add("collaborationType", 0.5, null);
  else if (person.preferredCollabs.includes(opp.collaborationType)) {
    total += add("collaborationType", 1, `Prefers ${collaborationLabels[opp.collaborationType].toLowerCase()}`);
  }

  // 5. Availability.
  if (person.availability.includes("UNAVAILABLE")) {
    reasons.push({ factor: "availability", points: 0, text: "Marked as not available right now", positive: false });
  } else {
    const fit = AVAILABILITY_FIT[opp.collaborationType];
    if (person.availability.some((a) => fit.includes(a))) {
      total += add("availability", 1, "Availability matches this type of collaboration");
    } else if (person.availability.some((a) => GENERIC_AVAILABILITY.includes(a))) {
      total += add("availability", 0.6, "Open to collaborating");
    } else if (person.availability.length === 0) {
      total += add("availability", 0.3, null);
    }
  }

  // 6. Work mode.
  if (person.preferredWorkModes.length === 0) total += add("workMode", 0.5, null);
  else if (person.preferredWorkModes.includes(opp.workMode)) total += add("workMode", 1, `Prefers ${workModeLabels[opp.workMode].toLowerCase()} work`);

  // 7. Experience level.
  if (!opp.experienceLevel) total += add("experience", 1, null);
  else if (!person.experienceLevel) total += add("experience", 0.5, null);
  else {
    const diff = LEVEL_RANK[person.experienceLevel] - LEVEL_RANK[opp.experienceLevel];
    if (diff === 0) total += add("experience", 1, "Experience level matches");
    else if (diff === 1 || diff === -1) total += add("experience", 0.6, null);
    else if (diff > 1) total += add("experience", 0.4, null);
    else reasons.push({ factor: "experience", points: 0, text: "Role asks for more experience", positive: false });
  }

  // 8. Location (only relevant for on-site and hybrid roles).
  if (opp.workMode === "REMOTE" || !opp.location) total += add("location", 1, null);
  else if (person.location && sameArea(person.location, opp.location)) total += add("location", 1, `Based near ${opp.location}`);
  else reasons.push({ factor: "location", points: 0, text: `${workModeLabels[opp.workMode]} role in ${opp.location}`, positive: false });

  let score = Math.round(total);
  if (person.availability.includes("UNAVAILABLE")) score = Math.round(score * 0.2);
  reasons.sort((a, b) => Number(b.positive) - Number(a.positive) || b.points - a.points);
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function sameArea(a: string, b: string) {
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const pa = norm(a).split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  const pb = norm(b).split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  return pa.some((x) => pb.some((y) => x === y || x.includes(y) || y.includes(x)));
}

/** Short summary for UI badges. */
export function matchLabel(score: number) {
  if (score >= 75) return "Strong match";
  if (score >= 55) return "Good match";
  if (score >= 35) return "Possible match";
  return "Low match";
}
