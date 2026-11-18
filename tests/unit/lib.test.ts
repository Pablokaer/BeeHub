import { describe, expect, it } from "vitest";
import { tagSlug, tagDisplayName, normalizeTagList } from "@/lib/tags";
import { extractHashtags, extractMentions, safeUrl, tokenize } from "@/lib/text";
import { scoreMatch, type MatchPerson, type MatchOpportunity } from "@/lib/matching-engine";
import { isValidHandle, slugify, usernameBase } from "@/lib/slug";
import { availablePresets, INTEREST_PRESETS, LANGUAGE_PRESETS, SKILL_PRESETS } from "@/lib/profile-presets";
import { formToObject, opportunitySchema, signupSchema } from "@/lib/validation";

describe("tag normalization", () => {
  it("maps common spellings to one canonical slug", () => {
    expect(tagSlug("React.JS")).toBe("react");
    expect(tagSlug(" reactjs ")).toBe("react");
    expect(tagSlug("#UI/UX")).toBe("ui-ux");
    expect(tagSlug("C#")).toBe("csharp");
    expect(tagSlug("Artificial Intelligence")).toBe("artificial-intelligence");
    expect(tagSlug("AI")).toBe("artificial-intelligence");
    expect(tagSlug("Front-End")).toBe("frontend");
  });
  it("uses canonical display names", () => {
    expect(tagDisplayName("reactjs")).toBe("React");
    expect(tagDisplayName("c#")).toBe("C#");
    expect(tagDisplayName("  my   custom tag ")).toBe("my custom tag");
  });
  it("deduplicates by slug", () => {
    expect(normalizeTagList(["React", "reactjs", "React.js", "Python"])).toEqual(["React", "Python"]);
  });
});

describe("content tokenizer", () => {
  it("finds mentions, hashtags and links without HTML", () => {
    const t = tokenize("Hi @ana-dev, check https://example.com/x. #React <b>x</b>");
    expect(t.map((x) => x.kind)).toEqual(["text", "mention", "text", "link", "text", "hashtag", "text"]);
    expect(extractMentions("@Ana @ana and email me@test.com")).toEqual(["ana"]);
    expect(extractHashtags("#AI and #ai #Python")).toEqual(["AI", "ai", "Python"]);
  });
  it("only allows http(s) links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://ok.test/a")).toBe("https://ok.test/a");
  });
});

describe("handles", () => {
  it("validates and slugifies", () => {
    expect(slugify("Ação Café Project!")).toBe("acao-cafe-project");
    expect(isValidHandle("good-name")).toBe(true);
    expect(isValidHandle("admin")).toBe(false);
    expect(isValidHandle("-bad")).toBe(false);
  });
});

describe("validation", () => {
  it("collects repeated inputs and row groups from FormData", () => {
    const fd = new FormData();
    fd.append("skills", "React");
    fd.append("skills", "TypeScript");
    fd.append("links[].label", "Site");
    fd.append("links[].url", "https://a.test");
    fd.append("links[].label", "");
    fd.append("links[].url", "");
    const o = formToObject(fd, ["skills", "interests"]);
    expect(o.skills).toEqual(["React", "TypeScript"]);
    expect(o.interests).toEqual([]);
    expect(o.links).toEqual([{ label: "Site", url: "https://a.test" }]);
  });
  it("rejects weak signups", () => {
    const r = signupSchema.safeParse({ displayName: "A", email: "x", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["displayName", "email", "password"]);
  });
  it("signs up with only name, email and password", () => {
    const r = signupSchema.safeParse({ displayName: "Ana", email: "Ana@Example.test", password: "correct horse battery" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ displayName: "Ana", email: "ana@example.test", password: "correct horse battery" });
  });
  it("requires at least one skill on opportunities", () => {
    const r = opportunitySchema.safeParse({ owner: "user", title: "Need help", description: "x".repeat(30), category: "DESIGN", collaborationType: "VOLUNTEER", workMode: "REMOTE", skills: [] });
    expect(r.success).toBe(false);
  });
});

describe("matching engine", () => {
  const react = { slug: "react", name: "React" };
  const ts = { slug: "typescript", name: "TypeScript" };
  const fe = { slug: "frontend", name: "Frontend" };
  const opp: MatchOpportunity = { skills: [react, ts], topics: [fe], collaborationType: "VOLUNTEER", workMode: "REMOTE", experienceLevel: "JUNIOR", location: null };
  const base: MatchPerson = { skills: [react, ts, fe], interests: [], availability: ["OPEN_TO_VOLUNTEER"], preferredCollabs: ["VOLUNTEER"], preferredWorkModes: ["REMOTE"], experienceLevel: "JUNIOR", location: "Lisbon" };

  it("scores a strong, explainable match", () => {
    const r = scoreMatch(base, opp);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.reasons[0].text).toContain("2 of 2 requested skills");
    expect(r.reasons.every((x) => typeof x.text === "string")).toBe(true);
  });
  it("is deterministic", () => {
    expect(scoreMatch(base, opp)).toEqual(scoreMatch(base, opp));
  });
  it("penalizes missing skills and unavailability", () => {
    const none = scoreMatch({ ...base, skills: [] }, opp);
    const unavailable = scoreMatch({ ...base, availability: ["UNAVAILABLE"] }, opp);
    expect(none.score).toBeLessThan(60);
    expect(unavailable.score).toBeLessThan(25);
    expect(unavailable.reasons.some((r) => !r.positive && r.text.includes("not available"))).toBe(true);
  });
  it("considers location only for on-site roles", () => {
    const onsite = { ...opp, workMode: "ONSITE" as const, location: "Porto" };
    const far = scoreMatch(base, onsite);
    const near = scoreMatch({ ...base, location: "Porto, Portugal" }, onsite);
    expect(near.score).toBeGreaterThan(far.score);
  });
});

describe("username from name", () => {
  it("slugifies names, dropping accents", () => {
    expect(usernameBase("Ana Silva")).toBe("ana-silva");
    expect(usernameBase("José Álvarez-Núñez")).toBe("jose-alvarez-nunez");
  });
  it("falls back to a neutral base when the name can't produce a valid handle", () => {
    expect(usernameBase("李明")).toBe("member");
    expect(usernameBase("Al")).toBe("member");
    expect(usernameBase("Admin")).toBe("member");
  });
  it("keeps room for a numeric suffix", () => {
    expect(usernameBase("a".repeat(60)).length).toBeLessThanOrEqual(30);
  });
});

describe("profile suggestion presets", () => {
  it("hides presets already chosen, comparing normalized tags", () => {
    expect(availablePresets(["React", "Node.js", "AI", "Figma"], ["reactjs", "Artificial Intelligence"], tagSlug)).toEqual(["Node.js", "Figma"]);
  });
  it("compares free-form values case-insensitively", () => {
    expect(availablePresets(["English", "Portuguese"], ["english"], (v) => v.trim().toLowerCase())).toEqual(["Portuguese"]);
  });
  it("ships presets for skills, interests and languages", () => {
    for (const list of [SKILL_PRESETS, INTEREST_PRESETS, LANGUAGE_PRESETS]) {
      expect(list.length).toBeGreaterThanOrEqual(10);
      expect(new Set(list).size).toBe(list.length);
    }
    expect(new Set(SKILL_PRESETS.map(tagSlug)).size).toBe(SKILL_PRESETS.length);
    expect(new Set(INTEREST_PRESETS.map(tagSlug)).size).toBe(INTEREST_PRESETS.length);
  });
});
