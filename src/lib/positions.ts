import type { OpportunityCategory } from "@/generated/prisma/enums";

/**
 * Catalog of positions an opportunity can be for. Publishers pick one (autocomplete), and
 * people filter opportunities by it, so ids are stable slugs and labels are what members see.
 * Each position belongs to an area (used for grouping and to pre-fill the opportunity
 * category) and may list aliases that the search also matches ("frontend", "PM", "SRE"…).
 */
export type Position = { id: string; label: string; area: PositionArea; aliases: string[] };

export type PositionArea =
  | "engineering"
  | "ai-data"
  | "it-infra"
  | "design"
  | "product"
  | "marketing"
  | "content"
  | "sales"
  | "customer"
  | "operations"
  | "finance-legal"
  | "people"
  | "leadership"
  | "research"
  | "quality"
  | "partnership"
  | "education"
  | "other";

export const POSITION_AREAS: Record<PositionArea, { label: string; category: OpportunityCategory }> = {
  engineering: { label: "Software engineering", category: "ENGINEERING" },
  "ai-data": { label: "AI & data", category: "ENGINEERING" },
  "it-infra": { label: "IT, cloud & security", category: "ENGINEERING" },
  design: { label: "Design & creative", category: "DESIGN" },
  product: { label: "Product & project management", category: "PRODUCT" },
  marketing: { label: "Marketing & growth", category: "MARKETING" },
  content: { label: "Content, media & communication", category: "CONTENT" },
  sales: { label: "Sales & business development", category: "SALES_BUSINESS" },
  customer: { label: "Customer success & support", category: "OPERATIONS" },
  operations: { label: "Operations & administration", category: "OPERATIONS" },
  "finance-legal": { label: "Finance, legal & investment", category: "INVESTMENT" },
  people: { label: "People & talent", category: "OPERATIONS" },
  leadership: { label: "Founders & leadership", category: "OTHER" },
  research: { label: "Research", category: "RESEARCH" },
  quality: { label: "Quality & testing", category: "TESTING_QA" },
  partnership: { label: "Partners & collaborators", category: "PARTNERSHIP" },
  education: { label: "Mentoring & education", category: "OTHER" },
  other: { label: "Other", category: "OTHER" },
};

/** "Label | alias, alias" per line, grouped by area. */
const RAW: Record<PositionArea, string[]> = {
  engineering: [
    "Software engineer | developer, programmer, dev, coder",
    "Frontend developer | front-end, front end, web developer, ui developer",
    "Backend developer | back-end, back end, api developer, server",
    "Full-stack developer | fullstack, full stack",
    "Web developer | website, html, css",
    "React developer | react.js, reactjs",
    "Next.js developer | nextjs",
    "Vue.js developer | vue",
    "Angular developer",
    "Node.js developer | node, nodejs, javascript backend",
    "Python developer | django, flask, fastapi",
    "Java developer | spring",
    "Go developer | golang",
    "Ruby on Rails developer | rails, ruby",
    "PHP developer | laravel",
    ".NET developer | c#, csharp, dotnet",
    "Rust developer",
    "Mobile developer | app developer, mobile app",
    "iOS developer | swift, iphone",
    "Android developer | kotlin",
    "React Native developer | mobile react",
    "Flutter developer | dart",
    "Game developer | gamedev, unity, unreal",
    "Unity developer | game, c#",
    "Unreal Engine developer | game, c++",
    "Embedded systems engineer | firmware, iot, hardware, microcontroller",
    "Blockchain developer | web3, crypto",
    "Smart contract developer | solidity, ethereum, web3",
    "WordPress developer | wordpress, wp",
    "Shopify developer | e-commerce, ecommerce, liquid",
    "No-code / low-code developer | webflow, bubble, airtable, zapier, nocode",
    "API / integrations engineer | integrations, api",
    "Software architect | architecture",
    "Solutions architect",
    "Tech lead | technical lead, lead developer",
    "Engineering manager | dev manager",
    "Open source maintainer | oss",
    "Browser extension developer | chrome extension",
    "Desktop app developer | electron",
    "AR/VR developer | augmented reality, virtual reality, xr",
  ],
  "ai-data": [
    "AI engineer | artificial intelligence, ai developer, genai",
    "Machine learning engineer | ml engineer, ml",
    "LLM engineer | large language model, gpt, openai, rag",
    "Prompt engineer | prompts, prompting",
    "AI agent developer | agents, autonomous agents, automation",
    "MLOps engineer | ml ops, model deployment",
    "Computer vision engineer | cv, image recognition",
    "NLP engineer | natural language processing, text",
    "Data scientist | data science",
    "Data analyst | analytics, analyst",
    "Data engineer | etl, pipelines, data pipeline",
    "Analytics engineer | dbt",
    "Business intelligence analyst | bi, power bi, tableau, dashboards",
    "AI researcher | ml research",
    "Data annotator | labeling, annotation",
    "AI product specialist | ai product",
    "Statistician | statistics",
    "Database administrator | dba, sql, postgres, mysql",
  ],
  "it-infra": [
    "DevOps engineer | devops, ci/cd",
    "Site reliability engineer | sre, reliability",
    "Cloud engineer | aws, azure, gcp, google cloud",
    "Cloud architect",
    "Platform engineer | kubernetes, infrastructure",
    "Infrastructure engineer | infra",
    "Systems administrator | sysadmin, linux",
    "Network engineer | networking",
    "Cybersecurity engineer | security engineer, infosec",
    "Security analyst | soc",
    "Penetration tester | pentester, ethical hacker",
    "IT support specialist | helpdesk, help desk, tech support",
    "IT manager | it",
    "IT consultant",
    "ERP / CRM consultant | salesforce, sap, hubspot",
  ],
  design: [
    "Product designer | digital product design",
    "UX designer | user experience",
    "UI designer | user interface, visual design",
    "UX/UI designer | ui/ux, ux ui",
    "UX researcher | user research",
    "UX writer | microcopy, content design",
    "Interaction designer | ixd",
    "Design system designer | design systems",
    "Web designer | website design",
    "Graphic designer | graphics",
    "Brand designer | branding, visual identity, logo",
    "Illustrator | illustration",
    "Pixel artist | pixel art, sprites",
    "Motion designer | motion graphics, animation, after effects",
    "Animator | 2d animation, 3d animation",
    "3D artist | 3d modeling, blender",
    "Game artist | game art, concept art",
    "Game designer | level design, gameplay",
    "Video editor | editing, premiere, final cut",
    "Photographer | photography",
    "Presentation designer | pitch deck, slides",
    "Packaging designer | packaging",
    "Creative director | art director",
    "Accessibility specialist | a11y, wcag",
  ],
  product: [
    "Product manager | pm, product",
    "Product owner | po",
    "Technical product manager | tpm",
    "Growth product manager | growth pm",
    "Product analyst",
    "Product operations | product ops",
    "Project manager | project management",
    "Program manager",
    "Scrum master | agile coach, agile",
    "Delivery manager",
    "Business analyst | requirements",
    "Startup generalist | generalist",
  ],
  marketing: [
    "Marketing manager | marketing",
    "Digital marketing specialist | digital marketing",
    "Growth marketer | growth hacker, growth",
    "Performance marketer | paid media, paid ads, ads",
    "SEO specialist | seo, search engine optimization",
    "SEM / PPC specialist | google ads, ppc, sem",
    "Social media manager | social media, instagram, tiktok",
    "Community manager | community",
    "Content marketer | content marketing",
    "Email marketing specialist | newsletter, email",
    "CRM / lifecycle marketer | lifecycle, retention, crm",
    "Product marketing manager | pmm, go-to-market, gtm",
    "Brand manager | brand",
    "Marketing analyst | marketing analytics",
    "Influencer marketing manager | influencers, creators",
    "Affiliate marketing manager | affiliates",
    "Public relations specialist | pr, press, media relations",
    "Event manager | events",
    "Conversion rate optimization specialist | cro, a/b testing",
    "Marketplace / e-commerce marketer | amazon, marketplace",
  ],
  content: [
    "Copywriter | copy, copywriting",
    "Content writer | blog writer, articles",
    "Technical writer | documentation, docs",
    "Editor | proofreading, proofreader",
    "Translator | translation",
    "Localization specialist | localization, l10n",
    "Content creator | creator, youtuber, ugc",
    "Video producer | video production",
    "Podcast producer | podcast, audio",
    "Journalist | reporter",
    "Communications manager | communications, comms",
    "Scriptwriter | screenwriter, scripts",
    "Newsletter writer",
    "Voice-over artist | voice actor, narration",
    "Music composer | music, sound design, audio",
  ],
  sales: [
    "Sales representative | sales, seller",
    "Sales development representative | sdr, bdr, lead generation, prospecting",
    "Account executive | ae, closer",
    "Account manager",
    "Business development manager | bizdev, business development, bd",
    "Partnerships manager | partnerships",
    "Sales manager | head of sales",
    "Sales engineer | presales, pre-sales",
    "E-commerce manager | ecommerce, online store",
    "Marketplace manager",
    "Channel / reseller manager | resellers, channel",
    "Fundraising manager | fundraising, grants",
    "Grant writer | grants, proposals",
  ],
  customer: [
    "Customer success manager | csm, customer success",
    "Customer support specialist | support, customer service",
    "Community moderator | moderation, moderator",
    "Onboarding specialist | onboarding",
    "Technical support engineer | support engineer",
  ],
  operations: [
    "Operations manager | ops, operations",
    "Virtual assistant | va, assistant",
    "Executive assistant | ea",
    "Office manager | admin",
    "Administrative assistant",
    "Project coordinator | coordinator",
    "Logistics coordinator | logistics, supply chain",
    "Procurement specialist | purchasing",
    "Data entry specialist | data entry",
    "Revenue operations | revops, sales ops",
    "Business operations analyst | bizops",
  ],
  "finance-legal": [
    "Accountant | accounting, bookkeeping, bookkeeper",
    "Financial analyst | finance, fp&a",
    "CFO / finance lead | finance manager",
    "Lawyer / legal counsel | legal, attorney, lawyer",
    "Compliance specialist | compliance, gdpr, privacy",
    "Investor | angel investor, angel, vc",
    "Venture capital analyst | vc analyst",
    "Fundraising advisor | pitch, investment",
    "Tax advisor | tax",
  ],
  people: [
    "Recruiter | recruiting, talent acquisition, hiring",
    "HR / people manager | hr, human resources, people ops",
    "Talent sourcer | sourcing",
    "Learning & development specialist | l&d, training",
  ],
  leadership: [
    "Co-founder | cofounder, partner, founder",
    "Technical co-founder | technical cofounder, cto cofounder",
    "Business co-founder | business cofounder",
    "CEO | chief executive",
    "CTO | chief technology officer",
    "COO | chief operating officer",
    "CMO | chief marketing officer",
    "CPO | chief product officer",
    "Advisor | board advisor, advisory",
    "Board member | board",
    "Interim / fractional executive | fractional",
  ],
  research: [
    "Researcher | research",
    "Academic researcher | phd, academic, scientist",
    "Market researcher | market research",
    "User researcher | user research, interviews",
    "Research assistant | ra",
    "Policy analyst | policy, public policy",
  ],
  quality: [
    "QA engineer | quality assurance, qa",
    "QA automation engineer | test automation, cypress, playwright, selenium",
    "Manual tester | tester, testing",
    "Beta tester | beta, early adopter",
    "Game tester | playtester",
    "Accessibility tester | screen reader, a11y testing",
    "Performance / load tester | load testing",
  ],
  partnership: [
    "Business partner | partner company",
    "Technology partner | tech partner, integration partner",
    "Distribution partner | distribution, reseller",
    "Retail partner | retail, stores",
    "Pilot customer | pilot, early customer",
    "Sponsor | sponsorship",
    "Agency / studio partner | agency, studio",
    "Nonprofit partner | ngo, charity",
    "Academic partner | university, school",
    "Media partner | media",
    "Volunteer | volunteering",
  ],
  education: [
    "Mentor | mentorship, coaching",
    "Coach | career coach",
    "Teacher / instructor | teacher, instructor, tutor",
    "Workshop facilitator | facilitator",
    "Intern | internship, trainee, student",
    "Apprentice | junior",
  ],
  other: ["Other role | other"],
};

function slug(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.net/g, "dotnet")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const POSITIONS: readonly Position[] = Object.freeze(
  (Object.entries(RAW) as [PositionArea, string[]][]).flatMap(([area, lines]) =>
    lines.map((line) => {
      const [label = "", aliases = ""] = line.split("|").map((s) => s.trim());
      return Object.freeze({ id: slug(label), label, area, aliases: aliases ? aliases.split(",").map((a) => a.trim().toLowerCase()) : [] });
    }),
  ),
);

const BY_ID = new Map(POSITIONS.map((p) => [p.id, p]));

export function findPosition(id: string | null | undefined): Position | null {
  return id ? BY_ID.get(id) ?? null : null;
}

export function isPositionId(id: string): boolean {
  return BY_ID.has(id);
}

/** Opportunity category suggested for a position (used to pre-fill the form). */
export function positionCategory(id: string): OpportunityCategory | null {
  const p = findPosition(id);
  return p ? POSITION_AREAS[p.area].category : null;
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Positions matching what was typed, best first: label starts with the query, then a word of
 * the label starts with it, then an alias, then the label contains it. Empty query = all.
 */
export function searchPositions(query: string, limit = 50): Position[] {
  const q = fold(query.trim());
  if (!q) return POSITIONS.slice(0, limit);
  const scored: [number, Position][] = [];
  for (const p of POSITIONS) {
    const label = fold(p.label);
    let score = -1;
    if (label.startsWith(q)) score = 0;
    else if (label.split(/[^a-z0-9.#+]+/).some((w) => w.startsWith(q))) score = 1;
    else if (p.aliases.some((a) => a === q)) score = 2;
    else if (p.aliases.some((a) => a.startsWith(q) || a.split(/\s+/).some((w) => w.startsWith(q)))) score = 3;
    else if (label.includes(q)) score = 4;
    else if (p.aliases.some((a) => a.includes(q))) score = 5;
    if (score >= 0) scored.push([score, p]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length).slice(0, limit).map(([, p]) => p);
}

/** Position ids whose label or aliases contain every word of a free-text search. */
export function positionIdsMatchingText(text: string): string[] {
  const words = fold(text).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  return POSITIONS.filter((p) => {
    const hay = fold([p.label, ...p.aliases].join(" "));
    return words.every((w) => hay.includes(w));
  }).map((p) => p.id);
}
