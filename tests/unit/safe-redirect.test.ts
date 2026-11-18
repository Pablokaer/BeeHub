import { expect, it } from "vitest";
import { safeRedirect } from "@/lib/safe-redirect";
it.each(["//evil.test", "/\\evil.test", "/\n/evil.test", "/\t/evil.test", "https://evil.test", null])("rejects an external or ambiguous redirect: %j", (value) => {
  expect(safeRedirect(value)).toBe("/feed");
});
it("preserves valid internal destinations and queries", () => {
  expect(safeRedirect("/discover?q=design#results")).toBe("/discover?q=design#results");
});
