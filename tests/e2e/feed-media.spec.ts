import path from "node:path";
import { expect, test } from "@playwright/test";
import { account, signUpAndVerify } from "./helpers";

const PANORAMA = path.join(__dirname, "fixtures", "pixel-garden.webp");

test("a panoramic image posted from the composer keeps its framing; Back works from in-app and direct visits", async ({ page }) => {
  const a = account("media", "Mira Mel");
  await signUpAndVerify(page, a);

  // The composer shows Image, Link and Post before the editor is focused.
  const composer = page.getByRole("region", { name: "Create a post" });
  await expect(composer.getByRole("button", { name: /Post/ })).toBeVisible();
  await expect(composer.getByText("Image", { exact: true })).toBeVisible();
  await expect(composer.getByRole("button", { name: "Link" })).toBeVisible();

  await page.getByLabel("Post text").fill("The apiary is ready! Looking for someone to draw the garden sprites.");
  await composer.locator('input[type="file"]').setInputFiles(PANORAMA);
  await expect(composer.locator('input[name="imageKeys"]')).toHaveCount(1);
  await composer.getByRole("button", { name: /Post/ }).click();

  const post = page.getByRole("article", { name: `Post by ${a.name}` }).first();
  const img = post.locator("img[src^='/api/media/']");
  await expect(img).toBeVisible();
  // Rendered at the column width with its own aspect ratio (no crop of the panorama).
  const { natural, rendered, column } = await img.evaluate((el: HTMLImageElement) => ({
    natural: el.naturalWidth / el.naturalHeight,
    rendered: el.clientWidth / el.clientHeight,
    column: (el.closest("article") as HTMLElement).clientWidth - el.clientWidth,
  }));
  expect(Math.abs(natural - rendered)).toBeLessThan(0.05);
  expect(column).toBeLessThan(80);

  // Back from a profile reached inside the app returns to the previous page.
  await post.getByRole("link", { name: a.name }).first().click();
  await expect(page).toHaveURL(new RegExp(`/u/${a.username}$`));
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/feed/);

  // Opened directly, Back goes to a predictable place (the feed for members).
  const direct = await page.context().newPage();
  await direct.goto(`/u/${a.username}`);
  await direct.getByRole("link", { name: "Back" }).click();
  await expect(direct).toHaveURL(/\/feed/);
  await direct.close();
});
