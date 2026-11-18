import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";

export const RESULTS = path.join(__dirname, "results");
export const AUTH_DIR = path.join(os.tmpdir(), "collab-hub-a11y-auth");
export const DB_URL = process.env.A11Y_DATABASE_URL ?? "postgresql://hub:hub@localhost:55432/collab_hub";
export const PASSWORD = "collab-demo-2026";
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Marker used in every piece of content the audit creates, so it can be cleaned up (see cleanup.sql). */
export const MARKER = "[a11y-audit]";
export const PRIVATE_SLUG = "a11y-audit-private";

export const authFile = (who: "ana" | "morgan") => path.join(AUTH_DIR, `${who}.json`);

export function writeJson(rel: string, data: unknown) {
  const file = path.join(RESULTS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
export function writeText(rel: string, data: string) {
  const file = path.join(RESULTS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

export async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

export type Fixtures = {
  anaProject: string;
  anaOrg: string;
  anaOpportunity: string; // owned by ana (edit page)
  applyOpportunity: string; // someone else's, ana has not applied
  anaPost: string;
  otherPost: string; // someone else's post (report dialog)
  conversation: string;
  tag: string;
  connectTarget: string; // username ana is not connected to
  otherProfile: string; // a connected user
  privateSlug: string;
};

export function loadFixtures(): Fixtures {
  return JSON.parse(fs.readFileSync(path.join(RESULTS, "fixtures.json"), "utf8"));
}

/** Waits for the page to settle enough for axe: load + main landmark (or body) + a short idle. */
export async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

export type CompactViolation = {
  id: string;
  impact: string | null | undefined;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: number;
  targets: string[];
  sampleHtml: string;
  failureSummary: string;
};

export async function runAxe(page: Page, tags: string[] = AXE_TAGS) {
  const r = await new AxeBuilder({ page }).withTags(tags).analyze();
  const compact = (vs: typeof r.violations): CompactViolation[] =>
    vs.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      sampleHtml: v.nodes[0]?.html.slice(0, 300) ?? "",
      failureSummary: (v.nodes[0]?.failureSummary ?? "").slice(0, 500),
    }));
  return { violations: compact(r.violations), incomplete: compact(r.incomplete), passes: r.passes.length, axeVersion: r.testEngine.version };
}

/** WCAG 2.5.8 target size (minimum, 24x24 CSS px) with the spacing exception approximated. */
export async function targetSizes(page: Page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"], [tabindex]:not([tabindex="-1"])';
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
    };
    const els = Array.from(document.querySelectorAll(sel)).filter((el) => {
      if (!visible(el)) return false;
      // sr-only controls wrapped in a label: measure the label instead (it's the real target).
      const r = el.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) return false;
      // visually hidden (clip / clip-path), e.g. the skip link before it is focused
      const s = getComputedStyle(el);
      if ((s.clip && s.clip !== "auto") || (s.clipPath && s.clipPath !== "none")) return false;
      return true;
    });
    const rects = els.map((el) => el.getBoundingClientRect());
    const out: { selector: string; text: string; w: number; h: number; inline: boolean; spacingOk: boolean; conflict?: string }[] = [];
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3).map((c) => `.${c.replace(/[^\w-]/g, "\\$&")}`).join("");
      const parent = el.parentElement ? el.parentElement.tagName.toLowerCase() + " > " : "";
      return `${parent}${el.tagName.toLowerCase()}${id}${cls}`;
    };
    els.forEach((el, i) => {
      const r = rects[i];
      if (r.width >= 24 && r.height >= 24) return;
      const s = getComputedStyle(el);
      // Inline exception: a link inside a sentence/paragraph of text.
      const inline = el.tagName === "A" && s.display === "inline" && !!el.parentElement && (el.parentElement.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 3;
      // Spacing exception: a 24px circle centred on the target must not intersect another target.
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const conflictIdx = rects.findIndex((o, j) => {
        if (j === i) return false;
        if (els[j].contains(el) || el.contains(els[j])) return false;
        const dx = Math.max(o.left - cx, 0, cx - o.right);
        const dy = Math.max(o.top - cy, 0, cy - o.bottom);
        return Math.hypot(dx, dy) < 12;
      });
      const spacingOk = conflictIdx < 0;
      out.push({
        selector: describe(el),
        text: ((el.getAttribute("aria-label") ?? el.textContent ?? "") as string).trim().replace(/\s+/g, " ").slice(0, 60),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        inline,
        spacingOk,
        conflict: conflictIdx < 0 ? undefined : `${describe(els[conflictIdx])} "${(els[conflictIdx].textContent ?? "").trim().slice(0, 30)}"`,
      });
    });
    return out;
  });
}

/** Information about document.activeElement, including whether it shows a focus indicator. */
export async function focusInfo(page: Page) {
  // Controls use `transition-colors` (150ms), which also animates outline-color/border-color;
  // measure only after the transition has finished.
  await page.waitForTimeout(220);
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) return { isBody: true, desc: "body", indicator: false } as const;
    const s = getComputedStyle(el);
    // Resolve any CSS colour (rgb, oklab, color-mix…) to sRGB through a canvas.
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx2d = cv.getContext("2d", { willReadFrequently: true })!;
    const parseColor = (c: string) => {
      if (!c || c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
      cx2d.clearRect(0, 0, 1, 1);
      cx2d.fillStyle = "rgba(0,0,0,0)";
      cx2d.fillStyle = c;
      cx2d.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = cx2d.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    // Split a computed box-shadow list on top-level commas and keep visible shadows.
    const shadows = (v: string) => {
      if (!v || v === "none") return [] as { color: { r: number; g: number; b: number; a: number }; size: number }[];
      const parts: string[] = [];
      let depth = 0;
      let cur = "";
      for (const ch of v) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
          parts.push(cur);
          cur = "";
        } else cur += ch;
      }
      parts.push(cur);
      return parts
        .map((p) => {
          const colorMatch = p.match(/(rgba?|oklab|oklch|lab|lch|color|hsla?)\([^)]*\)|#[0-9a-f]{3,8}/i);
          const nums = p.replace(colorMatch?.[0] ?? "", "").match(/-?[\d.]+px/g)?.map(parseFloat) ?? [];
          const size = Math.max(nums[2] ?? 0, nums[3] ?? 0);
          return { color: parseColor(colorMatch?.[0] ?? "black"), size };
        })
        .filter((x) => x.color.a > 0 && x.size > 0);
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // nearest opaque background behind the element
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c.a > 0.9) {
        bg = c;
        break;
      }
    }
    const blend = (c: { r: number; g: number; b: number; a: number }) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) });
    const ratio = (c: { r: number; g: number; b: number; a: number }) => {
      const l1 = lum(blend(c));
      const l2 = lum(bg);
      return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
    };
    let r = el.getBoundingClientRect();
    // Visually-hidden control (e.g. sr-only file input / chip checkbox): the visible target is its label.
    const clipped = r.width <= 2 || r.height <= 2;
    let box = clipped ? ((el.nextElementSibling as HTMLElement | null) ?? (el.closest("label") as HTMLElement | null) ?? el) : el;
    // Indicator drawn on a wrapper via :focus-within (e.g. TagInput): measure the wrapper.
    if (!clipped && s.outlineStyle === "none" && (s.boxShadow === "none" || !/px [1-9]/.test(s.boxShadow)) && el.parentElement && /focus-within:/.test(el.parentElement.className)) box = el.parentElement;
    const bs = box === el ? s : getComputedStyle(box);
    if (clipped) r = box.getBoundingClientRect();
    const outlineW = parseFloat(bs.outlineWidth) || 0;
    const outlineC = parseColor(bs.outlineColor);
    const hasOutline = bs.outlineStyle !== "none" && outlineW > 0 && outlineC.a > 0;
    const sh = shadows(bs.boxShadow);
    const hasShadow = sh.length > 0;
    const shadowContrast = sh.length ? Math.max(...sh.map((x) => ratio(x.color))) : 0;
    const borderContrast = parseFloat(bs.borderTopWidth) > 0 ? ratio(parseColor(bs.borderTopColor)) : 0;
    const indicatorContrast = Math.max(hasOutline ? ratio(outlineC) : 0, shadowContrast);
    const name = (el.getAttribute("aria-label") ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
    return {
      isBody: false,
      desc: `${role}${el.id ? "#" + el.id : ""} "${name}"`,
      tag: el.tagName.toLowerCase(),
      role,
      name,
      id: el.id,
      clipped,
      measuredOn: box === el ? "self" : clipped ? "label/sibling (sr-only control)" : "focus-within wrapper",
      outline: hasOutline ? `${bs.outlineStyle} ${bs.outlineWidth} ${bs.outlineColor}` : "none",
      boxShadow: hasShadow ? sh.map((x) => `${x.size}px rgba(${x.color.r},${x.color.g},${x.color.b},${x.color.a.toFixed(2)})`).join(" + ") : "none",
      borderContrast,
      indicator: hasOutline || hasShadow,
      indicatorContrast,
      inViewport: r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0,
      inMain: !!el.closest("main"),
      inDialog: !!el.closest("dialog[open], [role=dialog]"),
      inMenu: !!el.closest('[role="menu"]'),
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
    };
  });
}
export type FocusInfo = Awaited<ReturnType<typeof focusInfo>>;
