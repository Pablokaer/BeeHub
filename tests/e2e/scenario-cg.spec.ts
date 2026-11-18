import { expect, test } from "@playwright/test";
import { account, addTags, expectToast, newUserPage, signUpAndVerify, uid, L, T } from "./helpers";

test("Scenario C: an organization finds a partnership opportunity, applies and starts a conversation", async ({ page, browser }) => {
  const owner = account("acme", "Alice Acme");
  await signUpAndVerify(page, owner);
  const orgSlug = `acme-${uid()}`;
  await page.goto("/orgs/new");
  await L(page, "Organization name").fill("Acme Payments");
  await L(page, "Page URL").fill(orgSlug);
  await L(page, "Type").selectOption("STARTUP");
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL(`**/orgs/${orgSlug}/manage/members`);

  await page.goto("/opportunities/new");
  await L(page, "Published by").selectOption({ label: "Organization · Acme Payments" });
  await L(page, "Looking for…").fill("Retail partner for a payments pilot");
  await L(page, "Type of collaboration").selectOption("BUSINESS_PARTNERSHIP");
  await L(page, "Category").selectOption("PARTNERSHIP");
  await L(page, "Description").fill("We are looking for a retail company to pilot our new checkout product together.");
  await addTags(page, /^Skills wanted/, ["Business Development"]);
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await page.waitForURL(/\/opportunities\/[a-z0-9]+$/);

  const r = await newUserPage(browser);
  const retailer = account("shop", "Rui Retail");
  await signUpAndVerify(r, retailer);
  await r.goto("/orgs/new");
  await L(r, "Organization name").fill("Rui Retail Group");
  await L(r, "Page URL").fill(`rui-${uid()}`);
  await L(r, "Type").selectOption("COMPANY");
  await r.getByRole("button", { name: "Create organization" }).click();
  await r.waitForURL(/\/manage\/members/);

  await r.goto("/opportunities?type=BUSINESS_PARTNERSHIP&owner=org");
  await r.getByRole("link", { name: "Retail partner for a payments pilot" }).click();
  await L(r, "Why are you a good fit?").fill("We run 40 stores and want to pilot modern checkout payments.");
  await L(r, "Apply as").selectOption({ label: "Rui Retail Group" });
  await r.getByRole("button", { name: "Send application" }).click();
  await expect(r.getByRole("heading", { name: "Your application" })).toBeVisible();

  await page.goto("/applications/received");
  await expect(T(page, "on behalf of")).toBeVisible();
  await page.getByRole("button", { name: /^Message Rui/ }).click();
  await page.waitForURL(/\/messages\/[a-z0-9]+$/);
  await L(page, "Message", { exact: true }).fill("Hi Rui, thanks for your interest! When can we talk?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(T(page, "thanks for your interest")).toBeVisible();

  await r.goto("/messages");
  await r.getByRole("link", { name: /Alice Acme/ }).click();
  await expect(T(r, "thanks for your interest")).toBeVisible();
  await L(r, "Message", { exact: true }).fill("Tomorrow at 10 works for us.");
  await r.getByRole("button", { name: "Send" }).click();
  await expect(T(r, "Tomorrow at 10 works for us.")).toBeVisible();
  // The other side receives it through polling without reloading.
  await expect(T(page, "Tomorrow at 10 works for us.")).toBeVisible({ timeout: 15_000 });
});

test("Scenario G: two projects form a partnership visible on both pages", async ({ page, browser }) => {
  const a = account("aiproj", "Ada AI");
  await signUpAndVerify(page, a);
  const aSlug = `ai-${uid()}`;
  await page.goto("/projects/new");
  await L(page, "Project name").fill("Neural Notes");
  await L(page, "Project URL").fill(aSlug);
  await L(page, "One-line summary").fill("Machine learning that summarizes lecture recordings.");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(`**/p/${aSlug}`);

  const w = await newUserPage(browser);
  const b = account("webproj", "Wes Web");
  await signUpAndVerify(w, b);
  const bSlug = `web-${uid()}`;
  await w.goto("/projects/new");
  await L(w, "Project name").fill("Interface Kit");
  await L(w, "Project URL").fill(bSlug);
  await L(w, "One-line summary").fill("Accessible web interface components for research tools.");
  await w.getByRole("button", { name: "Create project" }).click();
  await w.waitForURL(`**/p/${bSlug}`);

  await w.goto(`/p/${aSlug}`);
  await w.getByRole("button", { name: "Propose partnership" }).click();
  await L(w, "Message").fill("Your ML + our interface components?");
  await w.getByRole("button", { name: "Send request" }).click();
  await expectToast(w, "Partnership request sent.");

  await page.goto(`/projects/${aSlug}/manage/partners`);
  await expect(T(page, "Your ML + our interface components?")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expectToast(page, /Partnership accepted/);

  await page.goto(`/p/${aSlug}`);
  await expect(page.getByRole("link", { name: /Interface Kit/ })).toBeVisible();
  await w.goto(`/p/${bSlug}`);
  await expect(w.getByRole("link", { name: /Neural Notes/ })).toBeVisible();
});
