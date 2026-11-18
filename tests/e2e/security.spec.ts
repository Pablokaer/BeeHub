import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { account, newUserPage, signUpAndVerify, uid, L, T } from "./helpers";

test("signed-out visitors are sent to sign in for member pages", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login\?next=%2Ffeed/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/);
});

test("public pages work signed out and private projects stay private", async ({ page, browser }) => {
  const owner = account("priv", "Pia Private");
  const ownerPage = await newUserPage(browser);
  await signUpAndVerify(ownerPage, owner);
  const slug = `secret-${uid()}`;
  await ownerPage.goto("/projects/new");
  await L(ownerPage, "Project name").fill("Secret Lab");
  await L(ownerPage, "Project URL").fill(slug);
  await L(ownerPage, "One-line summary").fill("Internal research that should never leak publicly.");
  await L(ownerPage, "Visibility").selectOption("PRIVATE");
  await ownerPage.getByRole("button", { name: "Create project" }).click();
  await ownerPage.waitForURL(`**/p/${slug}`);

  // Streamed pages send headers before the lookup finishes, so the not-found page arrives
  // with noindex rather than a 404 status. What matters: nothing about the project leaks.
  await page.goto(`/p/${slug}`);
  await expect(page.getByRole("heading", { name: "This page isn't available" })).toBeVisible();
  expect(await page.content()).not.toContain("never leak publicly");
  expect(await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")).join(" "))).toContain("noindex");
  await page.goto("/discover?type=projects&q=Secret");
  await expect(T(page, "No projects match these filters")).toBeVisible();
  // Non-members can't open admin pages either.
  const other = account("nosy", "Nora Nosy");
  await signUpAndVerify(page, other);
  await page.goto(`/projects/${slug}/manage`);
  await expect(page.getByRole("heading", { name: "This page isn't available" })).toBeVisible();
  expect(await page.content()).not.toContain("never leak publicly");
});

test("cross-site uploads are rejected", async ({ request }) => {
  const res = await request.post("/api/uploads", { headers: { origin: "https://evil.example" }, multipart: { purpose: "avatar" } });
  expect(res.status()).toBe(403);
});

for (const path of ["/", "/login", "/signup", "/opportunities", "/discover"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}
