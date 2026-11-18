import { expect, test } from "@playwright/test";
import { account, expectToast, signUpAndVerify, L } from "./helpers";

test("sign up with name, email and password, then add skills, interests and languages by clicking suggestions", async ({ page }) => {
  const a = account("presets", "Paula Presets");
  await signUpAndVerify(page, a);
  // The username comes from the name.
  expect(a.username).toMatch(/^paula-presets(-\d{4})?$/);

  await page.goto("/profile/edit");
  const skills = page.getByRole("group", { name: "Suggestions: Skills" }).filter({ visible: true });
  await skills.getByRole("button", { name: "Add React" }).click();
  // Focus moves to the chip that took the clicked one's place, so keyboard users can keep adding.
  await expect(skills.getByRole("button", { name: "Add React" })).toHaveCount(0);
  await expect(skills.getByRole("button", { name: "Add Node.js" })).toBeFocused();
  await skills.getByRole("button", { name: "Add Figma" }).click();
  await page.getByRole("group", { name: "Suggestions: Interests" }).filter({ visible: true }).getByRole("button", { name: "Add Education" }).click();
  await page.getByRole("group", { name: "Suggestions: Languages" }).filter({ visible: true }).getByRole("button", { name: "Add Portuguese" }).click();

  // Chosen values appear in the fields (removable) and can be mixed with typed ones.
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Portuguese" })).toBeVisible();
  await expect(L(page, /^Skills/)).toBeVisible();

  await page.getByRole("button", { name: "Save profile" }).click();
  await expectToast(page, "Profile saved.");

  // Skills, interests and languages live in the profile's About tab.
  await page.goto(`/u/${a.username}`);
  const tabs = page.getByRole("navigation", { name: "Profile sections" });
  await tabs.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\?tab=about/);
  await expect(tabs.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "React" }).first()).toBeVisible();
  await expect(main.getByRole("link", { name: "Figma" }).first()).toBeVisible();
  await expect(main.getByRole("link", { name: "Education" }).first()).toBeVisible();
  await expect(main.getByText("Portuguese")).toBeVisible();
});
