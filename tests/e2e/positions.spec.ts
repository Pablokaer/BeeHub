import { expect, test } from "@playwright/test";
import { account, L, pickPosition, signUpAndVerify } from "./helpers";

test("publish an opportunity by picking a position, then filter opportunities by it", async ({ page }) => {
  const a = account("pos", "Paula Posições");
  await signUpAndVerify(page, a);
  await page.goto("/opportunities/new");

  // Typing suggests positions (aliases included); keyboard picks one and fills the category.
  const box = page.getByRole("combobox", { name: /^Position you're looking for/ });
  await box.fill("genai");
  await expect(page.getByRole("option", { name: /^AI engineer/ })).toBeVisible();
  await box.press("Enter");
  await expect(box).toHaveValue("AI engineer");
  await expect(L(page, "Category")).toHaveValue("ENGINEERING");

  // Switch to a marketing role with the mouse; the category follows.
  await pickPosition(page, "seo", "SEO specialist");
  await expect(L(page, "Category")).toHaveValue("MARKETING");
  await L(page, "Description").fill("Help us rank our community map for local searches in three cities.");
  await page.getByRole("combobox", { name: /^Skills wanted/ }).fill("SEO");
  await page.getByRole("combobox", { name: /^Skills wanted/ }).press("Enter");
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await page.waitForURL(/\/opportunities\/[a-z0-9]+$/);
  // No title given: the position names the opportunity.
  await expect(page.getByRole("heading", { level: 1, name: "SEO specialist" })).toBeVisible();

  // The position links to a filtered list; the filter panel shows it as selected.
  await page.getByRole("link", { name: "SEO specialist" }).first().click();
  await expect(page).toHaveURL(/\/opportunities\?position=seo-specialist/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Remove SEO specialist" }).first()).toBeAttached();

  // Filtering by another position excludes it.
  await page.goto("/opportunities?position=pixel-artist");
  await expect(page.getByText("SEO specialist")).toHaveCount(0);
});
