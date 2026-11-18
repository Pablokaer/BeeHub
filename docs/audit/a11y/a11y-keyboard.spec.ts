import { test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { MARKER, PASSWORD, authFile, focusInfo, loadFixtures, query, settle, writeJson, type FocusInfo } from "./a11y-lib";

/**
 * Keyboard-only walkthrough of the core flows. Only page.keyboard is used to interact
 * (page.goto for entry points, locators only to observe). Findings are recorded, never asserted,
 * so one broken flow does not hide the others.
 */
type Step = { action: string; focus?: string; indicator?: boolean; indicatorContrast?: number; note?: string };
type Flow = { flow: string; steps: Step[]; issues: string[]; ok: string[]; error?: string };
const flows: Flow[] = [];

const short = (f: FocusInfo) => (f.isBody ? "<body> (focus lost)" : `${f.desc}${f.inMain ? " [main]" : ""}${f.inDialog ? " [dialog]" : ""}${f.inMenu ? " [menu]" : ""}`);

async function ctxFor(browser: Browser, who: "ana" | "out", extra: BrowserContextOptions = {}) {
  return browser.newContext({ baseURL: test.info().project.use.baseURL, storageState: who === "ana" ? authFile("ana") : undefined, viewport: { width: 1280, height: 800 }, ...extra });
}

type Match = { selector?: string; name?: RegExp };
async function activeMatches(page: Page, m: Match) {
  return page.evaluate(
    ({ selector, name }) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return false;
      if (selector && !el.matches(selector)) return false;
      if (name) {
        const n = (el.getAttribute("aria-label") ?? el.innerText ?? el.textContent ?? "").trim().replace(/\s+/g, " ");
        if (!new RegExp(name.source, name.flags).test(n)) return false;
      }
      return true;
    },
    { selector: m.selector, name: m.name ? { source: m.name.source, flags: m.name.flags } : undefined },
  );
}

/** Presses Tab (or Shift+Tab) until the focused element matches; records invisible focus stops and traps. */
async function tabUntil(page: Page, flow: Flow, m: Match, opts: { max?: number; back?: boolean; label: string }) {
  const max = opts.max ?? 80;
  let prev = "";
  let same = 0;
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(opts.back ? "Shift+Tab" : "Tab");
    const f = await focusInfo(page);
    if (!f.isBody && !f.indicator) {
      const msg = `No visible focus indicator on ${short(f)}`;
      if (!flow.issues.includes(msg)) flow.issues.push(msg);
    } else if (!f.isBody && f.indicatorContrast < 3) {
      const msg = `Low-contrast focus indicator (${f.indicatorContrast}:1 vs background; ${f.outline !== "none" ? "outline " + f.outline : "ring " + f.boxShadow}; border ${f.borderContrast}:1) on ${short(f)}`;
      if (!flow.issues.includes(msg)) flow.issues.push(msg);
    }
    if (short(f) === prev) {
      if (++same >= 3) {
        flow.issues.push(`Focus appears trapped on ${prev} while looking for ${opts.label}`);
        return { found: false, steps: i, focus: f };
      }
    } else same = 0;
    prev = short(f);
    if (await activeMatches(page, m)) {
      flow.steps.push({ action: `Tab x${i} to ${opts.label}`, focus: short(f), indicator: f.indicator, indicatorContrast: f.isBody ? 0 : f.indicatorContrast });
      return { found: true, steps: i, focus: f };
    }
  }
  flow.issues.push(`Could not reach ${opts.label} with ${max} ${opts.back ? "Shift+Tab" : "Tab"} presses`);
  return { found: false, steps: max, focus: await focusInfo(page) };
}

async function record(page: Page, flow: Flow, action: string, note?: string) {
  const f = await focusInfo(page);
  flow.steps.push({ action, focus: short(f), indicator: f.isBody ? undefined : f.indicator, indicatorContrast: f.isBody ? undefined : f.indicatorContrast, note });
  return f;
}

async function run(name: string, fn: (flow: Flow) => Promise<void>) {
  const flow: Flow = { flow: name, steps: [], issues: [], ok: [] };
  try {
    await fn(flow);
  } catch (e) {
    flow.error = String(e).split("\n").slice(0, 4).join(" ").slice(0, 600);
  }
  flows.push(flow);
}

/** Submits whatever form the focused button belongs to and inspects how errors are surfaced. */
async function inspectValidation(page: Page, flow: Flow, label: string) {
  await page.waitForTimeout(1500);
  const f = await focusInfo(page);
  const info = await page.evaluate(() => {
    const vis = (el: Element) => !!(el as HTMLElement).offsetParent || getComputedStyle(el).position === "fixed";
    const alerts = Array.from(document.querySelectorAll('[role="alert"]')).filter(vis).map((a) => (a.textContent ?? "").trim().slice(0, 120));
    const toasts = Array.from(document.querySelectorAll('[role="status"][aria-live] > div')).map((t) => (t.textContent ?? "").trim().slice(0, 120));
    const invalid = Array.from(document.querySelectorAll('[aria-invalid="true"]')).filter(vis).map((el) => {
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      const described = ids.map((id) => (document.getElementById(id)?.textContent ?? "").trim()).join(" | ");
      return { name: el.getAttribute("name"), describedBy: ids.join(" "), describedText: described.slice(0, 120), required: (el as HTMLInputElement).required, ariaRequired: el.getAttribute("aria-required") };
    });
    const visibleErrorTexts = Array.from(document.querySelectorAll("p.text-danger, .text-danger")).filter(vis).map((e) => (e.textContent ?? "").trim().slice(0, 80)).slice(0, 8);
    const firstInvalid = document.querySelector('[aria-invalid="true"]');
    return { alerts, toasts, invalid, visibleErrorTexts, focusOnFirstInvalid: !!firstInvalid && document.activeElement === firstInvalid, focusOnAlert: !!document.activeElement?.closest('[role="alert"]') };
  });
  flow.steps.push({ action: `Submit empty ${label}`, focus: short(f), note: JSON.stringify(info) });
  if (!info.focusOnFirstInvalid && !info.focusOnAlert) flow.issues.push(`${label}: after an invalid submit focus stays on ${short(f)} — not moved to an error summary or the first invalid field`);
  else flow.ok.push(`${label}: focus moved to ${info.focusOnAlert ? "error summary" : "first invalid field"}`);
  if (info.alerts.length) flow.ok.push(`${label}: form-level error rendered in role="alert" ("${info.alerts[0]}")`);
  else if (info.toasts.length) flow.issues.push(`${label}: error only shown as a transient toast in the polite status region ("${info.toasts[0]}"); no persistent inline error`);
  else flow.issues.push(`${label}: no role="alert"/live announcement of the error found`);
  const undescribed = info.invalid.filter((i) => !i.describedText);
  if (info.invalid.length && !undescribed.length) flow.ok.push(`${label}: ${info.invalid.length} field(s) aria-invalid with aria-describedby pointing at the error text`);
  if (undescribed.length) flow.issues.push(`${label}: aria-invalid field(s) without described error text: ${undescribed.map((u) => u.name).join(", ")}`);
  if (!info.invalid.length && info.visibleErrorTexts.length) flow.issues.push(`${label}: error text visible but no field is aria-invalid (${info.visibleErrorTexts.join(" / ")})`);
  const noReq = info.invalid.filter((i) => !i.required && i.ariaRequired !== "true");
  if (noReq.length) flow.issues.push(`${label}: invalid field(s) not exposed as required: ${noReq.map((u) => u.name).join(", ")}`);
  return info;
}

test.describe.configure({ mode: "default" });
test.setTimeout(180_000);

test("skip link", async ({ browser }) => {
  for (const [who, path] of [["out", "/"], ["ana", "/feed"], ["out", "/login"]] as const) {
    const ctx = await ctxFor(browser, who);
    const page = await ctx.newPage();
    await run(`Skip link → main (${who === "ana" ? "signed in" : "signed out"} ${path})`, async (flow) => {
      await page.goto(path);
      await settle(page);
      let f: FocusInfo;
      if (path === "/login") {
        // /login autofocuses the email field, so the skip link sits *behind* the start position.
        const first = await record(page, flow, "Page load (autofocus)");
        if (!first.isBody) flow.issues.push(`Page loads with focus already in the form (${short(first)}); the skip link is only reachable with Shift+Tab — acceptable, noted`);
        const back = await tabUntil(page, flow, { selector: 'a[href="#main"]' }, { label: "skip link (Shift+Tab)", back: true, max: 6 });
        f = back.focus;
      } else {
        await page.keyboard.press("Tab");
        f = await record(page, flow, "Tab from top of page");
      }
      const box = await page.locator('a[href="#main"]').boundingBox();
      if (!/skip to content/i.test(f.desc)) flow.issues.push(`First Tab stop is ${short(f)}, not the skip link`);
      else if (!box || box.width < 10) flow.issues.push("Skip link focused but not visible");
      else flow.ok.push(`Skip link is first Tab stop and becomes visible (${Math.round(box.width)}x${Math.round(box.height)})`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const after = await record(page, flow, "Enter on skip link", `url=${new URL(page.url()).hash}`);
      if (after.isBody) flow.issues.push('After activating the skip link document.activeElement is <body> (main#main has no tabindex="-1"); sequential focus start point moves, but SR virtual cursor/focus is not explicitly placed');
      await page.keyboard.press("Tab");
      const next = await record(page, flow, "Tab after skip link");
      if (next.inMain) flow.ok.push(`Next Tab lands inside <main>: ${short(next)}`);
      else flow.issues.push(`Next Tab after skip link lands outside <main>: ${short(next)}`);
    });
    await ctx.close();
  }
});

test("sign in", async ({ browser }) => {
  const ctx = await ctxFor(browser, "out");
  const page = await ctx.newPage();
  await run("Sign in (/login)", async (flow) => {
    await page.goto("/login");
    await settle(page);
    const f = await record(page, flow, "Page load");
    if (f.id && /email/i.test(f.desc)) flow.ok.push("Email field is autofocused on load");
    await page.keyboard.type("ana@demo.collabhub.local");
    await tabUntil(page, flow, { selector: 'input[type="password"]' }, { label: "Password field", max: 3 });
    await page.keyboard.type(PASSWORD);
    const r = await tabUntil(page, flow, { selector: 'button[type="submit"]', name: /^Sign in$/ }, { label: "Sign in button", max: 5 });
    if (r.found) {
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/feed/, { timeout: 20_000 });
      await settle(page);
      const after = await record(page, flow, "After sign-in navigation to /feed");
      const announcer = await page.evaluate(() => {
        const a = document.querySelector("next-route-announcer");
        return a?.shadowRoot?.textContent?.trim() ?? (a ? "(present, empty)" : null);
      });
      flow.steps.push({ action: "Next.js route announcer", note: String(announcer) });
      if (after.isBody) flow.issues.push("After sign-in redirect focus is on <body>; nothing focuses the page heading/main (route announcer: " + announcer + ")");
      flow.ok.push("Sign-in completes with keyboard only");
    }
  });
  await ctx.close();
});

test("form validation errors", async ({ browser }) => {
  const out = await ctxFor(browser, "out");
  const page = await out.newPage();
  await run("Validation: /login empty submit", async (flow) => {
    await page.goto("/login");
    await settle(page);
    await page.keyboard.press("Enter"); // email field is autofocused
    await inspectValidation(page, flow, "/login");
  });
  await run("Validation: /signup empty submit", async (flow) => {
    await page.goto("/signup");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'button[type="submit"]', name: /Create account/ }, { label: "Create account button" });
    if (r.found) {
      await page.keyboard.press("Enter");
      await inspectValidation(page, flow, "/signup");
    }
  });
  await run("Validation: /forgot-password empty submit", async (flow) => {
    await page.goto("/forgot-password");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'main button[type="submit"]' }, { label: "submit button" });
    if (r.found) {
      await page.keyboard.press("Enter");
      await inspectValidation(page, flow, "/forgot-password");
    }
  });
  await out.close();
  const ana = await ctxFor(browser, "ana");
  const p2 = await ana.newPage();
  await run("Validation: /projects/new empty submit", async (flow) => {
    await p2.goto("/projects/new");
    await settle(p2);
    const r = await tabUntil(p2, flow, { selector: 'main button[type="submit"]', name: /Create project/ }, { label: "Create project button", max: 120 });
    if (r.found) {
      await p2.keyboard.press("Enter");
      await inspectValidation(p2, flow, "/projects/new");
    }
  });
  await ana.close();
});

test("composer, like, comment", async ({ browser }) => {
  const ctx = await ctxFor(browser, "ana");
  const page = await ctx.newPage();
  const text = `${MARKER} keyboard composer post ${Date.now()}`;
  await run("Create a post in the feed composer", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: "#composer-body" }, { label: "composer textarea" });
    if (!r.found) return;
    await page.keyboard.type(text);
    const b = await tabUntil(page, flow, { selector: 'section[aria-label="Create a post"] button[type="submit"]' }, { label: "Post button", max: 10 });
    if (!b.found) return;
    await page.keyboard.press("Enter");
    await page.getByText(text).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    const after = await record(page, flow, "After publishing");
    const toast = await page.locator('[role="status"][aria-live]').first().innerText().catch(() => "");
    flow.steps.push({ action: "Status region text", note: toast });
    if (after.isBody) flow.issues.push("After publishing, the composer collapses and focus is dropped to <body> (Post button unmounted)");
    else flow.ok.push(`Focus after publishing: ${short(after)}`);
    if (toast) flow.ok.push(`Success announced in polite status region: "${toast}"`);
    else flow.issues.push("No status/toast announcement after publishing");
  });
  await run("Like a post (feed)", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: "main article button[aria-pressed]", name: /Like|Unlike/ }, { label: "first Like button" });
    if (!r.found) return;
    await page.evaluate(() => document.activeElement?.setAttribute("data-a11y-like", "1"));
    const btn = page.locator('[data-a11y-like="1"]');
    const before = await btn.getAttribute("aria-pressed");
    await page.keyboard.press("Space");
    // sample focus while the action is pending (button gets disabled={liking})
    await page.waitForTimeout(60);
    const during = await page.evaluate(() => ({ disabled: (document.activeElement as HTMLButtonElement | null)?.disabled ?? null, tag: document.activeElement?.tagName }));
    await page.waitForTimeout(1500);
    const pressed = await btn.getAttribute("aria-pressed").catch(() => "(button gone)");
    const f = await record(page, flow, "Space on Like", `aria-pressed ${before} -> ${pressed}; focus while pending: ${JSON.stringify(during)}`);
    if (f.isBody) flow.issues.push("Focus lost to <body> after toggling Like: the button is disabled while the action is pending (disabled={liking}), which blurs it");
    else flow.ok.push(`Focus kept on Like button (${short(f)})`);
    if (before === pressed) flow.issues.push("aria-pressed did not change after toggling Like");
    else flow.ok.push(`Like toggles via Space, aria-pressed ${before} -> ${pressed}`);
    // restore (keyboard): reload, tab back to the same button, toggle again
    await page.goto("/feed");
    await settle(page);
    const again = await tabUntil(page, { flow: "restore", steps: [], issues: [], ok: [] }, { selector: "main article button[aria-pressed]", name: /Like|Unlike/ }, { label: "first Like button (restore)" });
    if (again.found && (await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed"))) !== before) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(1500);
    }
  });
  await run("Comment on a post (/posts/[id])", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'main article a[href*="/posts/"]', name: /comments?$/ }, { label: "first comments link" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/posts\//);
    await settle(page);
    const nav = await record(page, flow, "After client-side navigation to post");
    if (nav.isBody) flow.issues.push("After navigating to the post, focus is on <body> (not moved to the post/heading)");
    else if (!nav.inMain) flow.issues.push(`After navigating to the post, focus remains on ${short(nav)} (outside main)`);
    const c = await tabUntil(page, flow, { selector: "textarea#c-root" }, { label: "comment textarea" });
    if (!c.found) return;
    const body = `${MARKER} keyboard comment ${Date.now()}`;
    await page.keyboard.type(body);
    const s = await tabUntil(page, flow, { selector: 'button[type="submit"]', name: /^Comment$/ }, { label: "Comment button", max: 4 });
    if (!s.found) return;
    await page.keyboard.press("Enter");
    await page.getByText(body).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    const after = await record(page, flow, "After submitting comment");
    if (after.isBody) flow.issues.push("Focus lost to <body> after submitting a comment");
    else flow.ok.push(`Comment posted; focus on ${short(after)}`);
    const announced = await page.locator('[role="status"][aria-live]').first().innerText().catch(() => "");
    if (!announced) flow.issues.push('Comment submission is not announced (successToast=false; comments list is not a live region)');
  });
  await ctx.close();
});

test("menus and dialogs", async ({ browser }) => {
  const ctx = await ctxFor(browser, "ana");
  const page = await ctx.newPage();
  const f = loadFixtures();
  await run("User menu (header)", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'header button[aria-haspopup="menu"]' }, { label: "Account menu button" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const exp = await page.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));
    const opened = await record(page, flow, "Enter on Account menu", `aria-expanded=${exp}`);
    if (!opened.inMenu) flow.issues.push(`Opening the menu leaves focus on ${short(opened)}; focus is not moved to the first menuitem (role="menu" pattern expects it)`);
    await page.keyboard.press("ArrowDown");
    const down = await record(page, flow, "ArrowDown");
    if (!down.inMenu) flow.issues.push("ArrowDown does not move focus into/through the role=menu items (no arrow-key support; items are reachable only with Tab)");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const esc = await record(page, flow, "Escape");
    const open = await page.locator('header [role="menu"]').count();
    if (open) flow.issues.push("Escape did not close the user menu");
    if (/Account menu/.test(esc.desc) || esc.desc.includes("aria-haspopup")) flow.ok.push("Escape closes the menu and focus returns to the trigger");
    else if (!open) {
      const isTrigger = await activeMatches(page, { selector: 'header button[aria-haspopup="menu"]' });
      if (isTrigger) flow.ok.push("Escape closes the menu and focus returns to the trigger");
      else flow.issues.push(`After Escape focus is on ${short(esc)}, not the trigger`);
    }
    // Tab through and out of the open menu: does it close when focus leaves?
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    let leftOpen = false;
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const inMenu = await page.evaluate(() => !!document.activeElement?.closest('[role="menu"]'));
      if (!inMenu && i > 0) {
        leftOpen = (await page.locator('header [role="menu"]').count()) > 0;
        const fi = await record(page, flow, `Tab out of menu after ${i + 1} presses`, `menu still open: ${leftOpen}`);
        if (leftOpen) flow.issues.push(`User menu stays open after focus moves out of it (focus now on ${short(fi)}); it can cover content`);
        break;
      }
    }
    await page.keyboard.press("Escape");
  });

  await run("Post options menu + Report dialog (/posts/[id])", async (flow) => {
    await page.goto(`/posts/${f.otherPost}`);
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'button[aria-label="Post options"]' }, { label: "Post options button" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const opened = await record(page, flow, "Enter on Post options");
    if (!opened.inMenu) flow.issues.push(`Post options menu opens but focus stays on ${short(opened)} (not moved into the menu)`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const esc = await record(page, flow, "Escape (menu)");
    if (await activeMatches(page, { selector: 'button[aria-label="Post options"]' })) flow.ok.push("Escape closes Post options menu, focus on trigger");
    else flow.issues.push(`After Escape on Post options menu focus is on ${short(esc)}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const m = await tabUntil(page, flow, { selector: '[role="menuitem"]', name: /Report post/ }, { label: "Report post menuitem", max: 4 });
    if (!m.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const d = await record(page, flow, "Enter on Report post (dialog opens)");
    const dialogOpen = await page.locator("dialog[open]").count();
    if (!dialogOpen) {
      flow.issues.push("Report dialog did not open");
      return;
    }
    if (d.inDialog) flow.ok.push(`Dialog opens with focus inside: ${short(d)}`);
    else flow.issues.push(`Dialog open but focus is on ${short(d)}`);
    const trail: string[] = [];
    let escaped = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const fi = await focusInfo(page);
      trail.push(short(fi));
      if (!fi.isBody && !fi.inDialog) escaped = true;
      if (!fi.isBody && !fi.indicator) {
        const msg = `No visible focus indicator on ${short(fi)}`;
        if (!flow.issues.includes(msg)) flow.issues.push(msg);
      }
    }
    flow.steps.push({ action: "Tab x10 inside dialog", note: trail.join(" → ") });
    if (trail.some((t) => t.startsWith("<body>"))) flow.ok.push("Tabbing past the last control leaves the page for browser chrome (activeElement=<body>) and cycles back into the dialog — native showModal() behaviour, page content stays inert");
    if (escaped) flow.issues.push("Focus escaped the modal dialog while tabbing");
    else flow.ok.push("Focus stays within the modal dialog (native <dialog>.showModal)");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const after = await record(page, flow, "Escape (dialog)");
    if (await page.locator("dialog[open]").count()) flow.issues.push("Escape did not close the dialog");
    if (await activeMatches(page, { selector: 'button[aria-label="Post options"]' })) flow.ok.push("Focus returns to Post options trigger after closing the dialog");
    else flow.issues.push(`After closing the Report dialog focus is on ${short(after)}, not the "Post options" trigger (the "Report post" menuitem that opened it was unmounted)`);
  });

  await run("Share options menu (feed)", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'main button[aria-haspopup="menu"]', name: /Share options/ }, { label: "Share options button" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const o = await record(page, flow, "Enter on Share options");
    if (!o.inMenu) flow.issues.push("Share menu opens but focus stays on the trigger");
    await page.keyboard.press("Tab");
    await record(page, flow, "Tab");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const e = await record(page, flow, "Escape");
    if (await activeMatches(page, { selector: 'button[aria-haspopup="menu"]', name: /Share options/ })) flow.ok.push("Escape returns focus to Share trigger");
    else flow.issues.push(`Escape from Share menu (with focus on a menuitem) closes it but focus goes to ${short(e)}, not back to the trigger`);
  });
  await ctx.close();
});

test("mobile bottom nav (360x800)", async ({ browser }) => {
  const ctx = await ctxFor(browser, "ana", { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await run("Mobile bottom nav + tab order at 360px", async (flow) => {
    await page.goto("/feed");
    await settle(page);
    const order: string[] = [];
    const obscured: string[] = [];
    let firstBottom = -1;
    let firstMain = -1;
    for (let i = 1; i <= 40; i++) {
      await page.keyboard.press("Tab");
      const fi = await focusInfo(page);
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const navs = Array.from(document.querySelectorAll('nav[aria-label="Main"]')).filter((n) => getComputedStyle(n).position === "fixed");
        const inBottom = navs.some((n) => n.contains(el));
        // Focus Not Obscured (2.4.11): how much of the element is hidden under the sticky header / fixed bottom nav
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) return { inBottom, covered: 0 }; // sr-only control, not measurable
        // sample a 5x3 grid of points; a point is covered if the topmost element there is not the focused element
        let hidden = 0;
        let total = 0;
        for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9])
          for (const fy of [0.2, 0.5, 0.8]) {
            const x = r.left + r.width * fx;
            const y = r.top + r.height * fy;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
              total++;
              hidden++;
              continue;
            }
            total++;
            const top = document.elementFromPoint(x, y);
            if (top && !el.contains(top) && !top.contains(el)) hidden++;
          }
        return { inBottom, covered: Math.round((hidden / Math.max(1, total)) * 100) };
      });
      order.push(`${i}:${short(fi)}${where.inBottom ? " [bottom-nav]" : ""}`);
      if (where.inBottom && firstBottom < 0) firstBottom = i;
      if (fi.inMain && firstMain < 0) firstMain = i;
      if (where.covered >= 50) obscured.push(`${short(fi)} (${where.covered}% covered)`);
      if (!fi.isBody && !fi.indicator) {
        const msg = `No visible focus indicator on ${short(fi)}`;
        if (!flow.issues.includes(msg)) flow.issues.push(msg);
      }
    }
    flow.steps.push({ action: "Tab x40 from top", note: order.join(" | ") });
    if (firstBottom > 0 && firstMain > 0 && firstBottom < firstMain) flow.issues.push(`Bottom nav (visually at the bottom) comes before <main> in tab order: bottom nav at stop ${firstBottom}, main at stop ${firstMain} (DOM order differs from visual order, WCAG 2.4.3)`);
    if (firstBottom < 0) flow.issues.push("Bottom nav not reached in 40 Tab presses");
    else flow.ok.push(`Bottom nav reachable by keyboard (first stop ${firstBottom})`);
    if (obscured.length) flow.issues.push(`Focused element >=50% hidden behind sticky header / fixed bottom nav (WCAG 2.4.11): ${obscured.slice(0, 5).join("; ")}`);
    else flow.ok.push("No focused element >=50% obscured by sticky header/fixed bottom nav in first 40 stops");
    // Activate "Network" from the bottom nav
    await page.goto("/feed");
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'nav[aria-label="Main"] a[href="/network"]' }, { label: "bottom-nav Network link" });
    if (r.found) {
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/network/);
      await settle(page);
      const after = await record(page, flow, "After activating Network");
      const current = await page.locator('nav[aria-label="Main"] a[aria-current="page"]').filter({ visible: true }).allInnerTexts();
      flow.steps.push({ action: "aria-current in bottom nav", note: current.join(",") });
      if (current.some((c) => /Network/.test(c))) flow.ok.push('Bottom nav marks the current page with aria-current="page"');
      flow.ok.push(`After client navigation focus stays on ${short(after)} (Next.js keeps focus on the clicked link; route announcer handles the title)`);
    }
    // Mobile user menu
    const um = await tabUntil(page, flow, { selector: 'header button[aria-haspopup="menu"]' }, { label: "Account menu (mobile)", back: true, max: 60 });
    if (um.found) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      const vis = await page.locator('header [role="menu"]').boundingBox();
      flow.steps.push({ action: "Open user menu at 360px", note: JSON.stringify(vis) });
      if (vis && (vis.x < 0 || vis.x + vis.width > 360)) flow.issues.push(`User menu overflows the 360px viewport (x=${Math.round(vis.x)}, w=${Math.round(vis.width)})`);
      await page.keyboard.press("Escape");
    }
  });
  await ctx.close();
});

test("connect, apply, message", async ({ browser }) => {
  const ctx = await ctxFor(browser, "ana");
  const page = await ctx.newPage();
  const f = loadFixtures();
  await run(`Send a connection request (/u/${f.connectTarget})`, async (flow) => {
    await page.goto(`/u/${f.connectTarget}`);
    await settle(page);
    const r = await tabUntil(page, flow, { selector: "main button", name: /^Connect with/ }, { label: "Connect button" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    const after = await record(page, flow, "After Enter on Connect");
    const toast = await page.locator('[role="status"][aria-live]').first().innerText().catch(() => "");
    flow.steps.push({ action: "Status region", note: toast });
    if (toast) flow.ok.push(`Result announced in polite status region: "${toast}"`);
    if (after.isBody) flow.issues.push("After sending the request the Connect button is replaced and focus drops to <body>");
    else flow.ok.push(`Focus after request: ${short(after)}`);
    // Withdraw again with the two-step inline confirm (keeps seed state)
    const w = await tabUntil(page, flow, { selector: "main button", name: /Request sent|Withdraw/i }, { label: "Withdraw/pending button", back: after.isBody ? false : true, max: 40 });
    if (w.found) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      const armed = await record(page, flow, "Enter (arms inline confirm)");
      if (!/Withdraw request\?/.test(armed.desc)) flow.issues.push("Inline confirm label not exposed on the focused button");
      else flow.ok.push('Inline confirm changes the focused button name to "Withdraw request?" (name change only, not announced as a live message)');
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
      const done = await record(page, flow, "Enter (confirm withdraw)");
      if (done.isBody) flow.issues.push("Focus lost to <body> after withdrawing the request");
    }
  });

  await run(`Apply to an opportunity (/opportunities/[id])`, async (flow) => {
    await page.goto(`/opportunities/${f.applyOpportunity}`);
    await settle(page);
    const r = await tabUntil(page, flow, { selector: 'main button[type="submit"]', name: /Send application/ }, { label: "Send application button" });
    if (!r.found) return;
    await page.keyboard.press("Enter");
    await inspectValidation(page, flow, "Apply form");
    const t = await tabUntil(page, flow, { selector: 'textarea[name="message"]' }, { label: "message textarea", back: true, max: 10 });
    if (!t.found) return;
    await page.keyboard.type(`${MARKER} I am applying with the keyboard only to audit this flow.`);
    const s = await tabUntil(page, flow, { selector: 'main button[type="submit"]', name: /Send application/ }, { label: "Send application button", max: 6 });
    if (!s.found) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    const after = await record(page, flow, "After sending application");
    const toast = await page.locator('[role="status"][aria-live]').first().innerText().catch(() => "");
    flow.steps.push({ action: "Status region", note: toast });
    if (after.isBody) flow.issues.push("After applying, the form is replaced and focus drops to <body>");
    if (toast) flow.ok.push(`Application result announced: "${toast}"`);
    else flow.issues.push("No announcement after submitting the application");
  });

  await run(`Send a message (/messages/[id])`, async (flow) => {
    await page.goto(`/messages/${f.conversation}`);
    await settle(page);
    const r = await tabUntil(page, flow, { selector: "#msg-body" }, { label: "message textarea", max: 120 });
    if (!r.found) return;
    if (r.steps > 25) flow.issues.push(`Message box needs ${r.steps} Tab presses from the top of the page`);
    const body = `${MARKER} keyboard message ${Date.now()}`;
    await page.keyboard.type(body);
    await page.keyboard.press("Enter");
    await page.locator("main ol li").filter({ hasText: body }).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);
    const after = await record(page, flow, "Enter to send");
    if (await activeMatches(page, { selector: "#msg-body" })) flow.ok.push("Enter sends; focus stays in the message box");
    else flow.issues.push(`After sending, focus moved to ${short(after)}`);
    const live = await page.evaluate(() => {
      const ol = document.querySelector("main ol[aria-live]");
      return ol ? { live: ol.getAttribute("aria-live"), relevant: ol.getAttribute("aria-relevant"), items: ol.children.length } : null;
    });
    flow.steps.push({ action: "Message list live region", note: JSON.stringify(live) });
    if (live) flow.issues.push(`Whole message history (<ol aria-live="polite">, ${live.items} items) is a live region — every poll/re-render can re-announce; prefer role="log" with aria-relevant="additions"`);
  });
  await ctx.close();
});

test.afterAll(async () => {
  writeJson("keyboard.json", flows);
  // what the audit created, so cleanup.sql can be verified
  const created = await query(`SELECT 'post' k, count(*)::int n FROM "Post" WHERE body LIKE '%[a11y-audit]%' UNION ALL SELECT 'comment', count(*)::int FROM "Comment" WHERE body LIKE '%[a11y-audit]%' UNION ALL SELECT 'message', count(*)::int FROM "Message" WHERE body LIKE '%[a11y-audit]%' UNION ALL SELECT 'application', count(*)::int FROM "Application" WHERE message LIKE '%[a11y-audit]%'`).catch((e) => [{ error: String(e) }]);
  writeJson("keyboard-created-data.json", created);
});
