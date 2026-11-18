// Aggregates docs/audit/a11y/results/sweep/*.json into results/summary.json and prints Markdown tables.
// Usage: node docs/audit/a11y/summarize.mjs
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "results");
const scans = fs
  .readdirSync(path.join(dir, "sweep"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, "sweep", f), "utf8")));

const sev = (v) => v.impact === "serious" || v.impact === "critical";
const impacts = ["critical", "serious", "moderate", "minor"];
const totals = { scans: scans.length, errored: scans.filter((s) => s.error).length, redirected: scans.filter((s) => s.redirected).length, byImpact: {}, nodesByImpact: {} };
for (const i of impacts) {
  totals.byImpact[i] = 0;
  totals.nodesByImpact[i] = 0;
}
const rules = {};
const incomplete = {};
for (const s of scans) {
  for (const v of s.violations ?? []) {
    totals.byImpact[v.impact] += 1;
    totals.nodesByImpact[v.impact] += v.nodes;
    const r = (rules[v.id] ??= { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: 0, scans: 0, routes: new Set(), variants: new Set(), targets: new Set(), sampleHtml: v.sampleHtml, failureSummary: v.failureSummary });
    r.nodes += v.nodes;
    r.scans += 1;
    r.routes.add(`${s.route} (${s.auth})`);
    r.variants.add(s.variant);
    for (const t of v.targets.slice(0, 3)) if (r.targets.size < 8) r.targets.add(t);
  }
  for (const v of s.incomplete ?? []) {
    const r = (incomplete[v.id] ??= { id: v.id, impact: v.impact, help: v.help, scans: 0, nodes: 0, routes: new Set() });
    r.scans += 1;
    r.nodes += v.nodes;
    r.routes.add(s.route);
  }
}
const ser = (o) => ({ ...o, routes: [...o.routes], variants: o.variants ? [...o.variants] : undefined, targets: o.targets ? [...o.targets] : undefined });
const ruleList = Object.values(rules).map(ser).sort((a, b) => impacts.indexOf(a.impact) - impacts.indexOf(b.impact) || b.nodes - a.nodes);
const incList = Object.values(incomplete).map(ser).sort((a, b) => b.nodes - a.nodes);

const rows = scans.map((s) => {
  const v = s.violations ?? [];
  return {
    route: s.route,
    path: s.path,
    auth: s.auth,
    variant: s.variant,
    status: s.status,
    finalUrl: s.finalUrl,
    redirected: s.redirected,
    title: s.title,
    lang: s.lang,
    h1: s.h1,
    error: s.error,
    seriousCritical: v.filter(sev).length,
    seriousCriticalNodes: v.filter(sev).reduce((n, x) => n + x.nodes, 0),
    moderateMinor: v.filter((x) => !sev(x)).length,
    moderateMinorNodes: v.filter((x) => !sev(x)).reduce((n, x) => n + x.nodes, 0),
    rules: v.map((x) => `${x.id}(${x.impact[0]}:${x.nodes})`).join(" "),
  };
});

// Titles (light-desktop, non-redirected)
const titles = {};
for (const s of scans.filter((s) => s.variant === "light-desktop" && !s.redirected && !s.error)) (titles[s.title] ??= []).push(`${s.route} [${s.auth}]`);
const dupTitles = Object.entries(titles).filter(([, r]) => r.length > 1);
const langs = [...new Set(scans.map((s) => s.lang))];

// Target size (WCAG 2.5.8): our own measurement, excluding inline links and spacing-exception passes.
const small = {};
let smallExempt = 0;
for (const s of scans.filter((s) => s.smallTargets)) {
  for (const t of s.smallTargets) {
    if (t.inline || t.spacingOk) {
      smallExempt++;
      continue;
    }
    const k = `${t.selector} "${t.text}"`;
    const e = (small[k] ??= { selector: t.selector, text: t.text, w: t.w, h: t.h, conflicts: new Set(), routes: new Set() });
    e.routes.add(`${s.route} [${s.auth} ${s.variant}]`);
    if (t.conflict) e.conflicts.add(t.conflict);
  }
}
const smallFail = Object.values(small).map((e) => ({ ...e, conflicts: [...e.conflicts].slice(0, 3), routes: [...e.routes] }));

// Best-practice pass (separate from WCAG totals)
const bp = {};
for (const s of scans) {
  for (const v of s.bestPractice ?? []) {
    const r = (bp[v.id] ??= { id: v.id, impact: v.impact, help: v.help, nodes: 0, scans: 0, routes: new Set(), targets: new Set() });
    r.nodes += v.nodes;
    r.scans += 1;
    r.routes.add(`${s.route} (${s.auth})`);
    for (const t of v.targets.slice(0, 2)) if (r.targets.size < 5) r.targets.add(t);
  }
}
const bpList = Object.values(bp).map(ser).sort((a, b) => b.scans - a.scans);

const summary = { generatedAt: new Date().toISOString(), totals, rules: ruleList, incomplete: incList, bestPractice: bpList, rows, duplicateTitles: dupTitles, langs, smallTargetsFailing: smallFail, smallTargetsExemptCount: smallExempt };
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));

// ---- Markdown output
const md = [];
md.push(`Scans: ${totals.scans} (errors: ${totals.errored}, redirected: ${totals.redirected})`);
md.push(`Rule-instances by impact: ${impacts.map((i) => `${i} ${totals.byImpact[i]} (${totals.nodesByImpact[i]} nodes)`).join(", ")}`);
md.push("\n### Rows\n| Route | Path | Auth | Variant | HTTP | S+C rules (nodes) | M+m rules (nodes) | Rules |\n|---|---|---|---|---|---|---|---|");
for (const r of rows) md.push(`| ${r.route} | \`${r.redirected ? r.path + " → " + r.finalUrl : r.path}\` | ${r.auth} | ${r.variant} | ${r.status ?? "-"} | ${r.seriousCritical} (${r.seriousCriticalNodes}) | ${r.moderateMinor} (${r.moderateMinorNodes}) | ${r.error ? "ERROR " + r.error.slice(0, 80) : r.rules} |`);
md.push("\n### Rules\n");
for (const r of ruleList) md.push(`- **${r.id}** (${r.impact}) — ${r.help}. nodes=${r.nodes}, scans=${r.scans}; variants: ${r.variants.join(", ")}\n  - routes: ${r.routes.join("; ")}\n  - targets: ${r.targets.map((t) => "`" + t + "`").join(", ")}\n  - html: \`${r.sampleHtml.replace(/`/g, "'").slice(0, 200)}\`\n  - summary: ${r.failureSummary.replace(/\n/g, " ").slice(0, 300)}`);
md.push("\n### Incomplete (needs review)\n");
for (const r of incList) md.push(`- ${r.id} (${r.impact}) nodes=${r.nodes} scans=${r.scans}: ${r.routes.slice(0, 6).join(", ")}`);
md.push("\n### Duplicate titles\n");
for (const [t, r] of dupTitles) md.push(`- "${t}": ${r.join(", ")}`);
md.push(`\nlang values: ${JSON.stringify(langs)}`);
md.push("\n### Small targets failing (not inline, no spacing exception)\n");
for (const e of smallFail) md.push(`- \`${e.selector}\` "${e.text}" ${e.w}x${e.h} — conflicts: ${e.conflicts.join("; ")} — ${e.routes.slice(0, 4).join(", ")}${e.routes.length > 4 ? ` (+${e.routes.length - 4})` : ""}`);
md.push(`\nSmall (<24px) instances passing via inline/spacing exception: ${smallExempt}`);
md.push("\n### Best-practice (not WCAG; light variants)\n");
for (const r of bpList) md.push(`- ${r.id} (${r.impact}) — ${r.help}. scans=${r.scans} nodes=${r.nodes}; routes: ${r.routes.slice(0, 8).join("; ")}${r.routes.length > 8 ? ` (+${r.routes.length - 8})` : ""}; targets: ${r.targets.map((t) => "`" + t + "`").join(", ")}`);
console.log(md.join("\n"));
