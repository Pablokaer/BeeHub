import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, tagSlug } from "@/lib/tags";
import { TECH_GROUPS, TECH_QUICK_PICKS, TECH_VOCABULARY, TOPIC_GROUPS, TOPIC_QUICK_PICKS, TOPIC_VOCABULARY } from "@/lib/project-vocabulary";

describe("project technologies and topics vocabulary", () => {
  for (const [name, groups, all, quick, min] of [
    ["technologies", TECH_GROUPS, TECH_VOCABULARY, TECH_QUICK_PICKS, 350],
    ["topics", TOPIC_GROUPS, TOPIC_VOCABULARY, TOPIC_QUICK_PICKS, 140],
  ] as const) {
    it(`${name}: broad, grouped, valid tags with no duplicates after normalization`, () => {
      expect(all.length).toBeGreaterThanOrEqual(min);
      expect(groups.length).toBeGreaterThanOrEqual(8);
      const slugs = all.map(tagSlug);
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      expect(dupes).toEqual([]);
      for (const item of all) {
        expect(tagSlug(item), item).not.toBe("");
        expect(item.length, item).toBeLessThanOrEqual(MAX_TAG_LENGTH);
      }
      for (const q of quick) expect(all).toContain(q);
    });
  }
});
