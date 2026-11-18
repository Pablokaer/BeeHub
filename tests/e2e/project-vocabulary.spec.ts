import { expect, test } from "@playwright/test";
import { account, L, signUpAndVerify, uid } from "./helpers";

test("project technologies and topics come from a broad vocabulary: autocomplete, quick picks and browse", async ({ page }) => {
  await signUpAndVerify(page, account("vocab", "Vera Vocab"));
  const slug = `vocab-${uid()}`;
  await page.goto("/projects/new");
  await L(page, "Project name").fill("Vocabulary Test");
  await L(page, "Project URL").fill(slug);
  await L(page, "One-line summary").fill("Checking the technology and topic suggestions.");

  // Typing suggests catalog technologies even if nobody has used them yet.
  const tech = page.getByRole("combobox", { name: /^Technologies/ });
  await tech.fill("terra");
  await page.getByRole("option", { name: "Terraform" }).click();
  // Quick pick chip.
  await page.getByRole("group", { name: "Suggestions: Technologies" }).getByRole("button", { name: "Add Docker" }).click();
  // Browse the grouped list.
  await page.getByRole("button", { name: /^Browse all technologies/ }).click();
  await page.getByRole("group", { name: "Technologies: AI & machine learning" }).getByRole("button", { name: "Add LangChain" }).click();

  const topics = page.getByRole("combobox", { name: /^Topics/ });
  await topics.fill("climate t");
  await page.getByRole("option", { name: "Climate Tech" }).click();
  await page.getByRole("button", { name: /^Browse all topics/ }).click();
  await page.getByRole("group", { name: "Topics: Health & science" }).getByRole("button", { name: "Add Mental Health" }).click();

  for (const chosen of ["Terraform", "Docker", "LangChain", "Climate Tech", "Mental Health"]) {
    await expect(page.getByRole("button", { name: `Remove ${chosen}` })).toBeVisible();
  }
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(`**/p/${slug}`);
  const main = page.getByRole("main");
  for (const shown of ["Terraform", "Docker", "LangChain", "Climate Tech", "Mental Health"]) {
    await expect(main.getByText(shown, { exact: true }).first()).toBeVisible();
  }
});
