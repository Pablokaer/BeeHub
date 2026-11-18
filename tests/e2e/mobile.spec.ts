import { expect, test } from "@playwright/test";
import { account, signUpAndVerify } from "./helpers";

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("layouts fit a phone screen and use the navigation grid above the content", async ({ page }) => {
  for (const path of ["/", "/opportunities", "/discover", "/login"]) {
    await page.goto(path);
    await noHorizontalScroll(page);
  }
  const u = account("mob", "Mo Mobile");
  await signUpAndVerify(page, u);
  // One main navigation per width: on phones it is the 3 × 2 grid above the content.
  const navs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  await expect(navs).toHaveCount(1);
  const nav = navs.first();
  for (const name of ["Feed", "Discover", "Opportunities", "My network", "Messages", "Saved"]) {
    await expect(nav.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  const navBox = await nav.boundingBox();
  const mainBox = await page.getByRole("main").boundingBox();
  expect(navBox!.y).toBeLessThan(mainBox!.y);
  await expect(page.getByRole("link", { name: /^Notifications/ })).toBeVisible();
  await nav.getByRole("link", { name: /Opportunities/ }).click();
  await expect(page).toHaveURL(/\/opportunities/);
  await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: /Opportunities/ })).toHaveAttribute("aria-current", "page");
  for (const path of ["/feed", "/network", "/messages", "/notifications", "/profile/edit", "/settings"]) {
    await page.goto(path);
    await noHorizontalScroll(page);
  }
});
