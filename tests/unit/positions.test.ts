import { describe, expect, it } from "vitest";
import { findPosition, isPositionId, POSITION_AREAS, POSITIONS, positionCategory, positionIdsMatchingText, searchPositions } from "@/lib/positions";
import { opportunitySchema } from "@/lib/validation";

describe("position catalog", () => {
  it("has many positions with unique, stable ids across every area", () => {
    expect(POSITIONS.length).toBeGreaterThan(200);
    expect(new Set(POSITIONS.map((p) => p.id)).size).toBe(POSITIONS.length);
    for (const p of POSITIONS) expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const area of Object.keys(POSITION_AREAS)) expect(POSITIONS.some((p) => p.area === area)).toBe(true);
    expect(findPosition("ai-engineer")?.label).toBe("AI engineer");
    expect(findPosition("dotnet-developer")?.label).toBe(".NET developer");
  });

  it("autocompletes from labels and aliases, best match first", () => {
    expect(searchPositions("front")[0]?.id).toBe("frontend-developer");
    expect(searchPositions("ai eng")[0]?.id).toBe("ai-engineer");
    expect(searchPositions("seo").map((p) => p.id)).toContain("seo-specialist");
    expect(searchPositions("sre").map((p) => p.id)).toContain("site-reliability-engineer");
    expect(searchPositions("pm").map((p) => p.id)).toContain("product-manager");
    expect(searchPositions("ux").map((p) => p.id)).toEqual(expect.arrayContaining(["ux-designer", "ux-researcher", "ux-writer"]));
    expect(searchPositions("zzzz")).toEqual([]);
  });

  it("maps positions to a category and to free-text search", () => {
    expect(positionCategory("social-media-manager")).toBe("MARKETING");
    expect(positionCategory("graphic-designer")).toBe("DESIGN");
    expect(positionIdsMatchingText("growth")).toEqual(expect.arrayContaining(["growth-marketer", "growth-product-manager"]));
  });

  it("requires a known position on opportunities; the title becomes optional", () => {
    const base = { owner: "user", description: "Help us build the web interface in React and TypeScript.", collaborationType: "VOLUNTEER", workMode: "REMOTE", skills: ["React"], publish: "on" };
    expect(opportunitySchema.safeParse(base).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, position: "not-a-position" }).success).toBe(false);
    const ok = opportunitySchema.safeParse({ ...base, position: "frontend-developer" });
    expect(ok.success).toBe(true);
    // No category given: the position's area decides it.
    expect(ok.success && ok.data.category).toBe("ENGINEERING");
    expect(isPositionId("frontend-developer")).toBe(true);
  });
});
