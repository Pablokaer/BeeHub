import { test } from "@playwright/test";
import { authFile, loadFixtures, settle, writeJson, writeText } from "./a11y-lib";

/**
 * Screen-reader proxy: ARIA snapshots of key pages plus structural checks
 * (landmarks, heading outline, images, live regions, unlabeled controls).
 * This is NOT a substitute for a manual VoiceOver/NVDA pass.
 */
test.use({ storageState: authFile("ana") });

const pages = () => {
  const f = loadFixtures();
  return [
    { name: "feed", path: "/feed" },
    { name: "profile", path: `/u/${f.otherProfile}` },
    { name: "opportunity", path: `/opportunities/${f.applyOpportunity}` },
    { name: "conversation", path: `/messages/${f.conversation}` },
  ];
};

for (const viewport of [
  { label: "desktop", size: { width: 1280, height: 800 } },
  { label: "360", size: { width: 360, height: 800 } },
]) {
  test(`aria structure (${viewport.label})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(viewport.size);
    const report: Record<string, unknown> = {};
    for (const p of pages()) {
      await page.goto(p.path);
      await settle(page);
      const snap = await page.locator("body").ariaSnapshot();
      writeText(`aria/${p.name}-${viewport.label}.body.yml`, snap);
      // Landmarks as Chromium's accessibility tree exposes them (from the ARIA snapshot).
      const landmarks = snap
        .split("\n")
        .map((l) => l.match(/^(\s*)- (banner|navigation|main|complementary|contentinfo|region|search|form)(?: "([^"]*)")?(?=:|$| \[)/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => `${"  ".repeat(m[1].length / 2)}${m[2]}${m[3] ? ` "${m[3]}"` : ""}`);
      const counts: Record<string, number> = {};
      for (const l of landmarks.map((x) => x.trim())) counts[l] = (counts[l] ?? 0) + 1;
      const snapshotLandmarks = { landmarks, duplicateLandmarks: Object.entries(counts).filter(([, n]) => n > 1).map(([l, n]) => `${l} x${n}`) };
      const mains = page.locator("main");
      if (await mains.count()) writeText(`aria/${p.name}-${viewport.label}.main.yml`, await mains.first().ariaSnapshot());
      const dom = await page.evaluate(() => {
        const visible = (el: Element) => {
          if ((el as HTMLElement).closest("[hidden], [aria-hidden='true']")) return false;
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") return false;
          // display:none ancestors
          for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).display === "none") return false;
          return true;
        };
        const txt = (el: Element | null) => (el?.textContent ?? "").trim().replace(/\s+/g, " ");
        const accName = (el: Element): string => {
          const lb = el.getAttribute("aria-labelledby");
          if (lb) return lb.split(/\s+/).map((id) => txt(document.getElementById(id))).join(" ").trim();
          const al = el.getAttribute("aria-label");
          if (al?.trim()) return al.trim();
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            const l = el.labels?.[0];
            if (l) return txt(l);
            return el.getAttribute("title") ?? el.getAttribute("placeholder") ?? "";
          }
          const visibleText = Array.from(el.querySelectorAll("*")).length === 0 ? txt(el) : (el as HTMLElement).innerText?.trim() || "";
          const imgAlt = Array.from(el.querySelectorAll("img[alt], svg[aria-label]")).map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label")).join(" ");
          // include sr-only text (innerText skips clipped? no: innerText includes it), fall back to textContent
          return (visibleText || txt(el) || imgAlt || el.getAttribute("title") || "").trim();
        };
        const landmarkSel = 'header, nav, main, aside, footer, form[aria-label], form[aria-labelledby], section[aria-label], section[aria-labelledby], [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"], [role="region"], [role="form"]';
        const landmarks = Array.from(document.querySelectorAll(landmarkSel))
          .filter(visible)
          .map((el) => {
            const role = el.getAttribute("role") ?? ({ HEADER: "banner?", NAV: "navigation", MAIN: "main", ASIDE: "complementary", FOOTER: "contentinfo?", FORM: "form", SECTION: "region" } as Record<string, string>)[el.tagName] ?? el.tagName;
            const named = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
            return `${role}${named ? ` "${accName(el).slice(0, 60)}"` : ""}`;
          });
        const counts: Record<string, number> = {};
        for (const l of landmarks) counts[l] = (counts[l] ?? 0) + 1;
        const duplicateLandmarks = Object.entries(counts).filter(([, n]) => n > 1).map(([l, n]) => `${l} x${n}`);
        const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]"))
          .filter(visible)
          .map((h) => ({ level: Number(h.getAttribute("aria-level") ?? h.tagName.slice(1)), text: txt(h).slice(0, 70) }));
        const skips: string[] = [];
        headings.forEach((h, i) => {
          const prev = i === 0 ? 0 : headings[i - 1].level;
          if (h.level > prev + 1) skips.push(`h${prev || "-"} -> h${h.level} ("${h.text}")`);
        });
        const images = Array.from(document.querySelectorAll("img, [role=img], svg"))
          .filter(visible)
          .map((el) => ({ tag: el.tagName.toLowerCase(), alt: el.getAttribute("alt"), ariaLabel: el.getAttribute("aria-label"), ariaHidden: el.getAttribute("aria-hidden"), role: el.getAttribute("role"), cls: (el.getAttribute("class") ?? "").slice(0, 40) }));
        const imgNoAlt = images.filter((i) => i.tag === "img" && i.alt === null).length;
        const svgUnhidden = images.filter((i) => i.tag === "svg" && i.ariaHidden !== "true" && !i.ariaLabel && i.role !== "img");
        const liveRegions = Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]")).map((el) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          live: el.getAttribute("aria-live"),
          label: el.getAttribute("aria-label"),
          children: el.children.length,
          visible: visible(el),
        }));
        const unlabeled = Array.from(document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=option]'))
          .filter(visible)
          .filter((el) => !accName(el))
          .map((el) => el.outerHTML.slice(0, 160));
        const ambiguous: Record<string, number> = {};
        for (const el of Array.from(document.querySelectorAll("a[href], button")).filter(visible)) {
          const n = accName(el).toLowerCase();
          if (/^(\d+|more|see all|view|view all|open|edit|remove|reply|delete|report)$/.test(n)) ambiguous[n] = (ambiguous[n] ?? 0) + 1;
        }
        return { title: document.title, lang: document.documentElement.lang, domLandmarksHeuristic: landmarks, domDuplicateLandmarks: duplicateLandmarks, headings, headingSkips: skips, h1Count: headings.filter((h) => h.level === 1).length, imgNoAlt, imagesWithEmptyAlt: images.filter((i) => i.tag === "img" && i.alt === "").length, imagesTotal: images.filter((i) => i.tag === "img").length, svgNotHidden: svgUnhidden.length, svgNotHiddenSample: svgUnhidden.slice(0, 3), liveRegions, unlabeledControls: unlabeled, ambiguousControlNames: ambiguous };
      });
      report[p.name] = { ...snapshotLandmarks, ...dom };
    }
    writeJson(`aria/structure-${viewport.label}.json`, report);
  });
}
