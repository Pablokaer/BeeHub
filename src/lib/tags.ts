/**
 * Tag normalization shared by server (persistence) and client (autocomplete).
 * Tags are stored by slug; the display name is kept from the first writer or the
 * canonical list below.
 */

/** Common spellings mapped to a canonical slug. */
const ALIASES: Record<string, string> = {
  reactjs: "react",
  "react-js": "react",
  "react.js": "react",
  nextjs: "next-js",
  "next.js": "next-js",
  nodejs: "node-js",
  "node.js": "node-js",
  node: "node-js",
  js: "javascript",
  ts: "typescript",
  "c-sharp": "csharp",
  "c#": "csharp",
  "c++": "cpp",
  golang: "go",
  py: "python",
  ai: "artificial-intelligence",
  "a-i": "artificial-intelligence",
  ml: "machine-learning",
  ux: "ui-ux",
  ui: "ui-ux",
  "ui-ux-design": "ui-ux",
  "ux-ui": "ui-ux",
  "front-end": "frontend",
  "back-end": "backend",
  "full-stack": "fullstack",
  "biz-dev": "business-development",
  bizdev: "business-development",
  "gamedev": "game-development",
  "game-dev": "game-development",
  "cyber-security": "cybersecurity",
  "infosec": "cybersecurity",
  "web3": "blockchain",
  "postgres": "postgresql",
  "k8s": "kubernetes",
};

/** Display names for well-known tags (used when a tag is first created). */
export const CANONICAL_NAMES: Record<string, string> = {
  python: "Python",
  java: "Java",
  csharp: "C#",
  cpp: "C++",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  "next-js": "Next.js",
  "node-js": "Node.js",
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full-stack",
  "ui-ux": "UI/UX",
  marketing: "Marketing",
  "artificial-intelligence": "Artificial Intelligence",
  "machine-learning": "Machine Learning",
  cybersecurity: "Cybersecurity",
  blockchain: "Blockchain",
  "game-development": "Game Development",
  "business-development": "Business Development",
  go: "Go",
  rust: "Rust",
  postgresql: "PostgreSQL",
  kubernetes: "Kubernetes",
  design: "Design",
  "product-management": "Product Management",
  "content-creation": "Content Creation",
  sales: "Sales",
  "data-science": "Data Science",
  devops: "DevOps",
  "mobile-development": "Mobile Development",
  "open-source": "Open Source",
  fintech: "Fintech",
  education: "Education",
  health: "Health",
  sustainability: "Sustainability",
  "qa-testing": "QA & Testing",
  copywriting: "Copywriting",
  seo: "SEO",
  "growth-marketing": "Growth Marketing",
  fundraising: "Fundraising",
};

export const MAX_TAG_LENGTH = 40;

/** Turns any user input ("  React.JS ", "#UI/UX") into a canonical slug ("react", "ui-ux"). */
export function tagSlug(input: string): string {
  let s = input.trim().toLowerCase().replace(/^#+/, "");
  if (ALIASES[s]) return ALIASES[s];
  s = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/c#/g, "csharp")
    .replace(/c\+\+/g, "cpp")
    .replace(/[/&+._\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_TAG_LENGTH);
  return ALIASES[s] ?? s;
}

/** Human display name for a freshly created tag. */
export function tagDisplayName(input: string): string {
  const slug = tagSlug(input);
  if (CANONICAL_NAMES[slug]) return CANONICAL_NAMES[slug];
  const cleaned = input.trim().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
  return cleaned || slug;
}

/** Normalizes and de-duplicates a list of raw tag inputs. */
export function normalizeTagList(inputs: string[], max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of inputs) {
    const slug = tagSlug(raw);
    if (!slug || slug.length < 1 || seen.has(slug)) continue;
    seen.add(slug);
    out.push(raw.trim());
    if (out.length >= max) break;
  }
  return out;
}
