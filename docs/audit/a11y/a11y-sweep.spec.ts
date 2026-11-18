import { test, type Browser } from "@playwright/test";
import { authFile, loadFixtures, runAxe, settle, targetSizes, writeJson, type Fixtures } from "./a11y-lib";

/**
 * axe sweep across every route (src/app/**\/page.tsx), signed out and signed in,
 * light/dark, desktop 1280x800 and mobile 360x800 for the main pages.
 * Records every violation (all impact levels); never fails on findings.
 */
type Auth = "signed-out" | "ana" | "morgan";
type Route = { route: string; path: string; main?: boolean };

const publicRoutes = (f: Fixtures): Route[] => [
  { route: "/", path: "/", main: true },
  { route: "/privacy", path: "/privacy" },
  { route: "/terms", path: "/terms" },
  { route: "/login", path: "/login", main: true },
  { route: "/signup", path: "/signup", main: true },
  { route: "/forgot-password", path: "/forgot-password" },
  { route: "/reset-password", path: "/reset-password" },
  { route: "/reset-password (bad token)", path: "/reset-password?token=invalid-token" },
  { route: "/verify-email", path: "/verify-email" },
  { route: "/verify-email (bad token)", path: "/verify-email?token=invalid-token" },
  { route: "/discover", path: "/discover", main: true },
  { route: "/discover?type=projects", path: "/discover?type=projects" },
  { route: "/opportunities", path: "/opportunities", main: true },
  { route: "/opportunities/[id]", path: `/opportunities/${f.applyOpportunity}`, main: true },
  { route: "/u/[username]", path: `/u/${f.otherProfile}`, main: true },
  { route: "/u/[username]/connections", path: `/u/${f.otherProfile}/connections` },
  { route: "/p/[slug]", path: `/p/${f.anaProject}`, main: true },
  { route: "/o/[slug]", path: `/o/${f.anaOrg}` },
  { route: "/posts/[id]", path: `/posts/${f.anaPost}` },
  { route: "/tags/[slug]", path: `/tags/${f.tag}` },
  { route: "404: /u/does-not-exist", path: "/u/does-not-exist" },
  { route: "404: /p/[private]", path: `/p/${f.privateSlug}` },
];

const memberRoutes = (f: Fixtures): Route[] => [
  { route: "/feed", path: "/feed", main: true },
  { route: "/discover", path: "/discover" },
  { route: "/opportunities", path: "/opportunities" },
  { route: "/opportunities/new", path: "/opportunities/new" },
  { route: "/opportunities/manage", path: "/opportunities/manage" },
  { route: "/opportunities/[id] (applicant view)", path: `/opportunities/${f.applyOpportunity}`, main: true },
  { route: "/opportunities/[id] (owner view)", path: `/opportunities/${f.anaOpportunity}` },
  { route: "/opportunities/[id]/edit", path: `/opportunities/${f.anaOpportunity}/edit` },
  { route: "/applications", path: "/applications" },
  { route: "/applications/received", path: "/applications/received" },
  { route: "/dev/mailbox", path: "/dev/mailbox" },
  { route: "/messages", path: "/messages", main: true },
  { route: "/messages/[id]", path: `/messages/${f.conversation}`, main: true },
  { route: "/my-projects", path: "/my-projects" },
  { route: "/network", path: "/network", main: true },
  { route: "/network/invitations", path: "/network/invitations" },
  { route: "/network/requests", path: "/network/requests" },
  { route: "/notifications", path: "/notifications", main: true },
  { route: "/o/[slug]", path: `/o/${f.anaOrg}` },
  { route: "/orgs/new", path: "/orgs/new" },
  { route: "/orgs/[slug]/manage", path: `/orgs/${f.anaOrg}/manage` },
  { route: "/orgs/[slug]/manage/members", path: `/orgs/${f.anaOrg}/manage/members` },
  { route: "/orgs/[slug]/manage/partners", path: `/orgs/${f.anaOrg}/manage/partners` },
  { route: "/orgs/[slug]/manage/settings", path: `/orgs/${f.anaOrg}/manage/settings` },
  { route: "/p/[slug]", path: `/p/${f.anaProject}`, main: true },
  { route: "/posts/[id]", path: `/posts/${f.anaPost}`, main: true },
  { route: "/profile/edit", path: "/profile/edit", main: true },
  { route: "/projects/new", path: "/projects/new" },
  { route: "/projects/[slug]/manage", path: `/projects/${f.anaProject}/manage`, main: true },
  { route: "/projects/[slug]/manage/gallery", path: `/projects/${f.anaProject}/manage/gallery` },
  { route: "/projects/[slug]/manage/partners", path: `/projects/${f.anaProject}/manage/partners` },
  { route: "/projects/[slug]/manage/settings", path: `/projects/${f.anaProject}/manage/settings` },
  { route: "/projects/[slug]/manage/team", path: `/projects/${f.anaProject}/manage/team` },
  { route: "/saved", path: "/saved" },
  { route: "/settings", path: "/settings", main: true },
  { route: "/settings/blocked", path: "/settings/blocked" },
  { route: "/settings/data", path: "/settings/data" },
  { route: "/settings/notifications", path: "/settings/notifications" },
  { route: "/settings/privacy", path: "/settings/privacy" },
  { route: "/tags/[slug]", path: `/tags/${f.tag}` },
  { route: "/u/[username] (own)", path: "/u/ana" },
  { route: "/u/[username] (other)", path: `/u/${f.otherProfile}`, main: true },
  { route: "/u/[username]/connections", path: "/u/ana/connections" },
  { route: "/ (signed in)", path: "/" },
  { route: "/privacy", path: "/privacy" },
  { route: "/terms", path: "/terms" },
];

const moderatorRoutes = (): Route[] => [{ route: "/moderation", path: "/moderation", main: true }];

type Variant = { name: string; colorScheme: "light" | "dark"; mobile: boolean; mainOnly: boolean };
const variants: Variant[] = [
  { name: "light-desktop", colorScheme: "light", mobile: false, mainOnly: false },
  { name: "dark-desktop", colorScheme: "dark", mobile: false, mainOnly: false },
  { name: "light-360", colorScheme: "light", mobile: true, mainOnly: true },
  { name: "dark-360", colorScheme: "dark", mobile: true, mainOnly: true },
];

async function sweep(browser: Browser, auth: Auth, variant: Variant, routes: Route[]) {
  const ctx = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: auth === "signed-out" ? undefined : authFile(auth),
    colorScheme: variant.colorScheme,
    viewport: variant.mobile ? { width: 360, height: 800 } : { width: 1280, height: 800 },
    isMobile: variant.mobile,
    hasTouch: variant.mobile,
  });
  const page = await ctx.newPage();
  const out = [];
  for (const r of routes.filter((r) => !variant.mainOnly || r.main)) {
    const entry: Record<string, unknown> = { route: r.route, path: r.path, auth, variant: variant.name };
    try {
      const res = await page.goto(r.path);
      await settle(page);
      // emulateMedia as well, so a theme toggle relying on matchMedia sees the scheme.
      await page.emulateMedia({ colorScheme: variant.colorScheme });
      entry.status = res?.status();
      entry.finalUrl = new URL(page.url()).pathname + new URL(page.url()).search;
      entry.redirected = entry.finalUrl !== r.path;
      entry.title = await page.title();
      entry.lang = await page.evaluate(() => document.documentElement.lang);
      entry.h1 = await page.locator("h1").filter({ visible: true }).allInnerTexts();
      entry.robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")));
      Object.assign(entry, await runAxe(page));
      if (r.main && variant.colorScheme === "light") entry.smallTargets = await targetSizes(page);
      // Best-practice rules (landmark-unique, heading-order, page-has-heading-one, region…) are
      // outside the WCAG tag set; recorded separately and excluded from the WCAG totals.
      if (variant.colorScheme === "light") entry.bestPractice = (await runAxe(page, ["best-practice"])).violations;
    } catch (e) {
      entry.error = String(e).slice(0, 500);
    }
    out.push(entry);
  }
  await ctx.close();
  writeJson(`sweep/${auth}--${variant.name}.json`, out);
}

test.describe.configure({ mode: "serial" });

for (const variant of variants) {
  test(`signed-out ${variant.name}`, async ({ browser }) => {
    test.setTimeout(900_000);
    await sweep(browser, "signed-out", variant, publicRoutes(loadFixtures()));
  });
  test(`ana ${variant.name}`, async ({ browser }) => {
    test.setTimeout(900_000);
    await sweep(browser, "ana", variant, memberRoutes(loadFixtures()));
  });
  test(`morgan ${variant.name}`, async ({ browser }) => {
    test.setTimeout(300_000);
    await sweep(browser, "morgan", variant, moderatorRoutes());
  });
}

test("member routes redirect when signed out; 404 status codes", async ({ playwright }) => {
  const f = loadFixtures();
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const probe = async (p: string) => {
    const res = await req.get(p, { maxRedirects: 0 });
    const body = res.status() === 200 ? await res.text() : "";
    return {
      path: p,
      status: res.status(),
      location: res.headers()["location"] ?? null,
      noindex: /<meta[^>]+name="robots"[^>]+noindex/.test(body),
      notFoundText: body.includes("This page isn&#x27;t available") || body.includes("This page isn't available"),
      leaksPrivate: body.includes("private project used to probe"),
    };
  };
  const statuses = [];
  for (const p of [
    "/u/does-not-exist",
    `/p/${f.privateSlug}`,
    "/p/does-not-exist",
    "/o/does-not-exist",
    "/posts/does-not-exist",
    "/opportunities/does-not-exist",
    "/tags/does-not-exist",
    "/this-route-does-not-exist",
    `/projects/${f.anaProject}/manage`,
    "/feed",
    "/moderation",
    "/settings",
  ])
    statuses.push(await probe(p));
  writeJson("status-codes.json", statuses);
  await req.dispose();
});

test("reduced motion: computed transitions/animations on /feed", async ({ browser }) => {
  const out: Record<string, unknown> = {};
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, storageState: authFile("ana"), reducedMotion });
    const page = await ctx.newPage();
    await page.goto("/feed");
    await settle(page);
    out[reducedMotion] = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      const withTransition = all.filter((el) => {
        const s = getComputedStyle(el);
        return s.transitionDuration.split(",").some((d) => parseFloat(d) > 0) && s.transitionProperty !== "none";
      });
      const withAnimation = all.filter((el) => getComputedStyle(el).animationName !== "none");
      const smooth = getComputedStyle(document.documentElement).scrollBehavior;
      return {
        elementsWithTransition: withTransition.length,
        sampleTransition: withTransition.slice(0, 3).map((el) => `${el.tagName.toLowerCase()}: ${getComputedStyle(el).transitionProperty} ${getComputedStyle(el).transitionDuration}`),
        elementsWithAnimation: withAnimation.length,
        scrollBehavior: smooth,
      };
    });
    await ctx.close();
  }
  writeJson("reduced-motion.json", out);
});
