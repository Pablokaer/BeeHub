import { expect, test } from "@playwright/test";
import { account, addTags, expectToast, newUserPage, signUpAndVerify, uid, L, T, pickPosition } from "./helpers";

test("Scenarios A, B & E: publish a project and opportunity, discover it, apply and get accepted", async ({ page, browser }) => {
  // Scenario B — a developer sets up a profile, a public project and an opportunity.
  const dev = account("dev", "Dana Developer");
  await signUpAndVerify(page, dev);
  await page.goto("/profile/edit");
  await L(page, "Headline").fill("Full-stack developer");
  await addTags(page, /^Skills/, ["React", "Node.js"]);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expectToast(page, "Profile saved.");

  const slug = `e2e-${uid()}`;
  await page.goto("/projects/new");
  await L(page, "Project name").fill("E2E Study Tool");
  await L(page, "Project URL").fill(slug);
  await L(page, "One-line summary").fill("An AI study tool built during end-to-end tests.");
  await L(page, "Category").selectOption("AI_ML");
  await L(page, "Stage").selectOption("PROTOTYPE");
  await addTags(page, /^Technologies/, ["Python"]);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(`**/p/${slug}`);
  await expect(page.getByRole("heading", { name: "E2E Study Tool", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "Publish opportunity" }).click();
  await pickPosition(page, "growth", "Growth marketer");
  await L(page, "Title").fill("Marketing specialist for launch");
  await L(page, "Type of collaboration").selectOption("FREELANCE");
  await L(page, "Category").selectOption("MARKETING");
  await L(page, "Description").fill("Plan our launch campaign and reach the first users with great copy.");
  await addTags(page, /^Skills wanted/, ["Marketing", "Copywriting"]);
  await L(page, "Compensation", { exact: true }).selectOption("FIXED");
  await L(page, "Compensation details").fill("€800");
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await page.waitForURL(/\/opportunities\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Marketing specialist for launch" })).toBeVisible();

  // Scenario A — a student finds it through tags and filters and applies.
  const s = await newUserPage(browser);
  const student = account("stu", "Sam Student");
  await signUpAndVerify(s, student);
  await s.goto("/profile/edit");
  await addTags(s, /^Skills/, ["Marketing", "Copywriting"]);
  await T(s, "Available for paid work").click();
  await s.getByRole("button", { name: "Save profile" }).click();
  await expectToast(s, "Profile saved.");

  // Scenario E — AI projects in prototype stage that need marketing help.
  await s.goto("/discover?type=projects&category=AI_ML&stage=PROTOTYPE&lookingFor=marketing");
  await expect(s.getByRole("link", { name: "E2E Study Tool" })).toBeVisible();

  await s.goto("/opportunities?skills=marketing&type=FREELANCE&paid=1");
  await s.getByRole("link", { name: "Marketing specialist for launch" }).click();
  await expect(s.getByRole("heading", { name: "Why this matches you" })).toBeVisible();
  await expect(T(s, /Has 2 of 2 requested skills/)).toBeVisible();
  await L(s, "Why are you a good fit?").fill("I have run three launch campaigns for student products.");
  await s.getByRole("button", { name: "Send application" }).click();
  await expect(s.getByRole("heading", { name: "Your application" })).toBeVisible();

  // The owner reviews and accepts.
  await page.goto("/applications/received");
  await expect(page.getByRole("link", { name: "Sam Student" })).toBeVisible();
  await L(page, "Move to").selectOption("ACCEPTED");
  await page.getByRole("button", { name: "Update" }).click();
  await expectToast(page, /Application updated/);

  await s.goto("/applications");
  await expect(T(s, "Accepted", { exact: true })).toBeVisible();
  await s.goto("/notifications");
  await expect(T(s, /was accepted/)).toBeVisible();
  await s.goto(`/p/${slug}`);
  await expect(s.getByRole("link", { name: "Sam Student" })).toBeVisible();
});
