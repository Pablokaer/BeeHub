import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { AUTH_DIR, PASSWORD, PRIVATE_SLUG, authFile, query, writeJson, type Fixtures } from "./a11y-lib";

/** Resolves real ids/slugs from the seeded DB and signs in the audit accounts (mouse allowed here). */
setup("resolve fixtures and sign in", async ({ browser }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const one = async (sql: string) => {
    const rows = await query<{ v: string }>(sql);
    expect(rows[0]?.v, sql).toBeTruthy();
    return rows[0].v;
  };
  const ana = await one(`SELECT id AS v FROM "User" WHERE username='ana'`);
  const fixtures: Fixtures = {
    anaProject: await one(`SELECT p.slug AS v FROM "Project" p JOIN "ProjectMember" m ON m."projectId"=p.id WHERE m."userId"='${ana}' AND m.role='OWNER' AND p.slug <> '${PRIVATE_SLUG}' ORDER BY p."createdAt" LIMIT 1`),
    anaOrg: await one(`SELECT o.slug AS v FROM "Organization" o JOIN "OrganizationMember" m ON m."organizationId"=o.id WHERE m."userId"='${ana}' AND m.role='OWNER' ORDER BY o."createdAt" LIMIT 1`),
    anaOpportunity: await one(`SELECT o.id AS v FROM "Opportunity" o JOIN "Project" p ON p.id=o."projectId" JOIN "ProjectMember" m ON m."projectId"=p.id WHERE m."userId"='${ana}' AND m.role='OWNER' ORDER BY o."createdAt" LIMIT 1`),
    applyOpportunity: await one(`SELECT o.id AS v FROM "Opportunity" o JOIN "Project" p ON p.id=o."projectId" WHERE p.slug='pixel-garden' AND o.status='OPEN' LIMIT 1`),
    anaPost: await one(`SELECT id AS v FROM "Post" WHERE "authorId"='${ana}' AND coalesce(body,'') <> '' AND body NOT LIKE '%[a11y-audit]%' ORDER BY "createdAt" DESC LIMIT 1`),
    otherPost: await one(`SELECT p.id AS v FROM "Post" p JOIN "User" u ON u.id=p."authorId" WHERE u.username='diogo' ORDER BY p."createdAt" DESC LIMIT 1`),
    conversation: await one(`SELECT cp."conversationId" AS v FROM "ConversationParticipant" cp WHERE cp."userId"='${ana}' LIMIT 1`),
    tag: await one(`SELECT t.slug AS v FROM "PostTag" pt JOIN "Tag" t ON t.id=pt."tagId" GROUP BY t.slug ORDER BY count(*) DESC LIMIT 1`),
    connectTarget: "elena",
    otherProfile: "diogo",
    privateSlug: PRIVATE_SLUG,
  };

  for (const who of ["ana", "morgan"] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(`${who}@demo.collabhub.local`);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/feed/);
    await ctx.storageState({ path: authFile(who) });

    // A private project is needed to check what signed-out visitors get (status code + no leak).
    if (who === "ana") {
      const exists = await query(`SELECT 1 FROM "Project" WHERE slug=$1`, [PRIVATE_SLUG]);
      if (!exists.length) {
        await page.goto("/projects/new");
        await page.getByLabel("Project name").fill("A11y audit private probe");
        await page.getByLabel("Project URL").fill(PRIVATE_SLUG);
        await page.getByLabel("One-line summary").fill("[a11y-audit] private project used to probe signed-out status codes.");
        await page.getByLabel("Visibility").selectOption("PRIVATE");
        await page.getByRole("button", { name: "Create project" }).click();
        await page.waitForURL(`**/p/${PRIVATE_SLUG}`);
      }
    }
    await ctx.close();
  }
  writeJson("fixtures.json", fixtures);
});
