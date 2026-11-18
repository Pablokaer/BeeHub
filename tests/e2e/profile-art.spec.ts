import { expect, test, type Page } from "@playwright/test";
import { account, expectToast, query, signUpAndVerify } from "./helpers";
import { syntheticPortrait } from "../fixtures/portrait";

const status = (page: Page, group: string) => page.getByRole("group", { name: group }).filter({ visible: true }).locator("p[aria-live]");

test("choose catalog art for avatar and cover, cancel keeps the previous choice, save persists it", async ({ page, browser }) => {
  const a = account("art", "Arte Abelha");
  await signUpAndVerify(page, a);
  await page.goto("/profile/edit");

  const avatar = page.getByRole("group", { name: "Profile picture" }).filter({ visible: true });
  const cover = page.getByRole("group", { name: "Cover" }).filter({ visible: true });
  await expect(status(page, "Profile picture")).toHaveText(/No picture/);

  // Cancel restores the previous selection and returns focus to the trigger.
  const chooseAvatar = avatar.getByRole("button", { name: "Choose illustration" });
  await chooseAvatar.click();
  const dialog = page.getByRole("dialog", { name: "Choose a portrait" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("Chapéu de palha", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /Chapéu de palha/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(chooseAvatar).toBeFocused();
  await expect(status(page, "Profile picture")).toHaveText(/No picture/);

  // Keyboard: arrows move between choices, Enter applies.
  await chooseAvatar.click();
  await dialog.getByRole("radio", { name: /Apicultora âmbar/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: /Flor de lavanda/ })).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(chooseAvatar).toBeFocused();
  await expect(status(page, "Profile picture")).toHaveText("Illustration: Flor de lavanda");

  await cover.getByRole("button", { name: "Choose illustration" }).click();
  const coverDialog = page.getByRole("dialog", { name: "Choose a cover" });
  await coverDialog.getByText("Olival à hora azul", { exact: true }).click();
  await coverDialog.getByRole("button", { name: "Use this cover" }).click();
  await expect(status(page, "Cover")).toHaveText("Illustration: Olival à hora azul");

  // Nothing is stored until the profile is saved.
  const before = await query<{ avatarArt: string | null }>(`SELECT p."avatarArt" FROM "Profile" p JOIN "User" u ON u.id = p."userId" WHERE u.email = $1`, [a.email]);
  expect(before[0]?.avatarArt).toBeNull();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expectToast(page, "Profile saved.");
  const after = await query<{ avatarArt: string | null; coverArt: string | null; avatarKey: string | null }>(
    `SELECT p."avatarArt", p."coverArt", p."avatarKey" FROM "Profile" p JOIN "User" u ON u.id = p."userId" WHERE u.email = $1`,
    [a.email],
  );
  expect(after[0]).toEqual({ avatarArt: "flor-de-lavanda", coverArt: "olival-a-hora-azul", avatarKey: null });

  // Reloading the editor shows the saved choice.
  await page.reload();
  await expect(status(page, "Cover")).toHaveText("Illustration: Olival à hora azul");

  // Another visitor (signed out) sees the art on the public profile.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/u/${a.username}`);
  const hero = visitor.locator("header[aria-labelledby='profile-name']");
  await expect(hero.locator("img[src='/brand/colmeia/capas/olival-a-hora-azul.webp']")).toBeVisible();
  await expect(hero.locator("img[src='/brand/colmeia/avatares/flor-de-lavanda.webp']")).toBeVisible();
  await expect(visitor.getByRole("heading", { level: 1, name: "Arte Abelha" })).toBeVisible();

  // Removing the avatar falls back to initials after saving.
  await avatar.getByRole("button", { name: "Remove" }).click();
  await expect(status(page, "Profile picture")).toHaveText(/No picture/);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expectToast(page, "Profile saved.");
  await visitor.reload();
  await expect(hero.locator("img[src='/brand/colmeia/avatares/flor-de-lavanda.webp']")).toHaveCount(0);
  await expect(hero.locator("img[src='/brand/colmeia/capas/olival-a-hora-azul.webp']")).toBeVisible();

  // An uploaded photo becomes a pixel portrait (preview, saved profile, other visitors).
  await avatar.locator('input[type="file"]').setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: await syntheticPortrait() });
  await expect(status(page, "Profile picture")).toHaveText("Your photo, as a pixel portrait.");
  await expect(avatar.locator("img[src$='.px.webp']").first()).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  // An earlier "Profile saved." toast may still be on screen, so wait for the stored value.
  await expect
    .poll(async () => (await query<{ avatarKey: string | null }>(`SELECT p."avatarKey" FROM "Profile" p JOIN "User" u ON u.id = p."userId" WHERE u.email = $1`, [a.email]))[0]?.avatarKey ?? "")
    .toMatch(/\.px\.webp$/);
  await visitor.reload();
  const portrait = hero.locator("img[src^='/api/media/'][src$='.px.webp']");
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveClass(/cm-pixel/);
  await visitorContext.close();
});

// Signed out on purpose: the theme toggle is in the header for everyone, and signups are
// rate limited per IP in production builds (5 per hour).
test("night theme persists across navigation and reload without a flash", async ({ page }) => {
  await page.goto("/opportunities");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Night theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Day theme" })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: "Discover" }).click();
  await expect(page).toHaveURL(/\/discover/);
  await expect(html).toHaveAttribute("data-theme", "dark");

  // The attribute is set by the head script before first paint, i.e. already at DOMContentLoaded.
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
  await page.getByRole("button", { name: "Day theme" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
});

test("Meet Bia dialog opens and returns focus", async ({ page }) => {
  await page.goto("/discover");
  const trigger = page.getByRole("button", { name: /Meet Bia/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Bia" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
