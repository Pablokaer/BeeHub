/**
 * Placeholder data for reviewing the product structure locally: fills the profile of an
 * existing account (by email) in every field and builds a small community around it —
 * people, organizations, public and private projects, galleries, opportunities, applications,
 * connections, follows, posts with images, comments, likes, saves, shares, partnerships,
 * team invitations and conversations. Everything goes through the service layer, so counters,
 * notifications and permissions behave as in production.
 *
 *   npx tsx --conditions=react-server scripts/demo/populate-placeholders.ts you@example.com
 *
 * Local development only. Runs once per database (skips if the placeholder organization exists).
 * New placeholder accounts use the password "collab-demo-2026". All names and content are fictitious.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { db } from "../../src/server/db";
import { signup } from "../../src/server/auth/service";
import type { Actor } from "../../src/server/auth/types";
import { updateProfile, upsertEducation, upsertExperience } from "../../src/server/profiles";
import { createOrganization } from "../../src/server/organizations";
import { addProjectImage, createProject } from "../../src/server/projects";
import { createOpportunity } from "../../src/server/opportunities";
import { applyToOpportunity, updateApplicationStatus } from "../../src/server/applications";
import { follow, respondToConnectionRequest, sendConnectionRequest } from "../../src/server/social/graph";
import { addComment, createPost, toggleLike, toggleSave } from "../../src/server/posts";
import { requestPartnership, respondToPartnership } from "../../src/server/partnerships";
import { inviteToProject, respondToInvitation } from "../../src/server/invitations";
import { sendMessage, startConversation } from "../../src/server/messaging";
import { storeImage, type UploadPurpose } from "../../src/server/uploads";
import { syntheticPortrait } from "../../tests/fixtures/portrait";

const PASSWORD = "collab-demo-2026";
const MARKER_ORG = "honeycomb-studio";
const ROOT = path.resolve(import.meta.dirname, "../..");
type P = Parameters<typeof updateProfile>[1];

if (process.env.NODE_ENV === "production") throw new Error("Placeholder data is for local development only.");

/** Rate limits are per subject; this script creates a burst of activity from few accounts. */
const quiet = async <T>(fn: () => Promise<T>) => {
  await db.rateLimit.deleteMany({});
  return fn();
};

async function upload(actor: Actor, data: Buffer, purpose: UploadPurpose, name = "image.webp") {
  await db.rateLimit.deleteMany({});
  const stored = await storeImage(actor, new File([new Uint8Array(data)], name, { type: "image/webp" }), purpose);
  return stored.key;
}
const brand = (file: string) => readFileSync(path.join(ROOT, "public/brand/colmeia", file));

/** Simple geometric logo (honeycomb cell + initials), generated locally. */
function logoSvg(initials: string, bg: string, fg: string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="${bg}"/>
    <polygon points="200,40 338,120 338,280 200,360 62,280 62,120" fill="${fg}" opacity="0.9"/>
    <polygon points="200,80 304,140 304,260 200,320 96,260 96,140" fill="${bg}"/>
    <text x="200" y="232" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" text-anchor="middle" fill="${fg}">${initials}</text>
  </svg>`);
}
const png = (svg: Buffer) => sharp(svg).png().toBuffer();

async function person(username: string, displayName: string, profile: Partial<P>): Promise<Actor> {
  const email = `${username}@placeholder.collabhub.local`;
  const u = await quiet(() => signup({ displayName, username, email, password: PASSWORD }, { ip: `placeholder-${username}` }));
  await db.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
  const actor: Actor = { id: u.id, username, role: "USER", status: "ACTIVE", emailVerified: true };
  await updateProfile(actor, { displayName, languages: ["English"], links: [], availability: [], preferredWorkModes: [], preferredCollabs: [], skills: [], interests: [], ...profile });
  return actor;
}

const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
/** Spread content over the last weeks so the feed and "time ago" labels look lived-in. */
async function backdate(postId: string, daysAgo: number) {
  await db.post.update({ where: { id: postId }, data: { createdAt: days(daysAgo) } });
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: populate-placeholders.ts <email of the account to fill>");
  if (await db.organization.findUnique({ where: { slug: MARKER_ORG } })) {
    console.log("Placeholder data already present – skipping.");
    return;
  }
  const owner = await db.user.findUnique({ where: { email }, select: { id: true, username: true, role: true, status: true, profile: { select: { avatarKey: true, avatarArt: true } } } });
  if (!owner) throw new Error(`No account with email ${email}.`);
  // The account must be able to publish, connect and message.
  await db.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: new Date() } });
  const me: Actor = { id: owner.id, username: owner.username, role: owner.role, status: owner.status, emailVerified: true };
  const existing = (u: string) => db.user.findUnique({ where: { username: u } }).then((x) => (x ? ({ id: x.id, username: x.username, role: x.role, status: x.status, emailVerified: true } as Actor) : null));
  const [ana, diogo, farid, grace, bruno, carla] = await Promise.all(["ana", "diogo", "farid", "grace", "bruno", "carla"].map(existing));

  // ───────── The account's own profile: every field ─────────
  await updateProfile(me, {
    displayName: "Iinu Moreira",
    headline: "Product designer & front-end developer · building tools for local communities",
    bio: "I design and build small, useful tools for neighbourhoods, makers and schools.\n\nRight now I'm leading Hive Map, an open map of community resources, and maintaining the Mel design system. I like accessible interfaces, honest copy and teams that ship weekly.\n\nAlways happy to mentor juniors and pair with backend folks. #Accessibility #OpenSource",
    location: "Coimbra, Portugal",
    languages: ["Portuguese", "English", "Spanish"],
    links: [
      { label: "Portfolio", url: "https://example.com/iinu" },
      { label: "GitHub", url: "https://example.com/github/iinu" },
      { label: "Blog", url: "https://example.com/iinu/blog" },
    ],
    availability: ["OPEN_TO_COLLABORATE", "LOOKING_FOR_PROJECTS", "OPEN_TO_PAID_WORK"],
    experienceLevel: "MID",
    preferredWorkModes: ["REMOTE", "HYBRID"],
    preferredCollabs: ["PAID", "FREELANCE", "PROJECT_PARTNERSHIP", "MENTORSHIP"],
    skills: ["React", "TypeScript", "Figma", "UI/UX", "Node.js", "Product Management", "Accessibility", "Design Systems"],
    interests: ["Education", "Sustainability", "Open Source", "Community Management", "Game Development"],
    avatarKey: owner.profile?.avatarKey ?? undefined,
    avatarArt: owner.profile?.avatarKey ? undefined : owner.profile?.avatarArt ?? "bandana-verde",
    coverArt: "costa-ao-entardecer",
  });
  await upsertExperience(me, { title: "Lead product designer", company: "Honeycomb Studio", location: "Coimbra (hybrid)", startDate: new Date("2024-03-01"), description: "Leading design and front-end for community tools. Built the Mel design system and the Hive Map MVP." });
  await upsertExperience(me, { title: "Front-end developer", company: "Bairro Digital Cooperative", location: "Remote", startDate: new Date("2021-09-01"), endDate: new Date("2024-02-01"), description: "React and TypeScript for local commerce platforms; accessibility audits and design reviews." });
  await upsertExperience(me, { title: "UX design intern", company: "Atlântico Learning Lab", location: "Lisbon", startDate: new Date("2020-06-01"), endDate: new Date("2020-12-01"), description: "Usability tests with teachers and students; prototypes in Figma." });
  await upsertEducation(me, { school: "University of Coimbra", degree: "MSc", field: "Human–Computer Interaction", startYear: 2019, endYear: 2021, description: "Thesis on accessible maps for neighbourhood services." });
  await upsertEducation(me, { school: "Polytechnic of Leiria", degree: "BSc", field: "Multimedia & Communication Design", startYear: 2016, endYear: 2019 });

  // ───────── Other people ─────────
  const helena = await person("helena-sousa", "Helena Sousa", { headline: "Community organizer · makerspace founder", avatarArt: "lenco-lilas", coverArt: "estufa-de-azulejos", bio: "Running Coimbra Makers Guild: workshops, repair cafés and open hardware nights.", location: "Coimbra, Portugal", skills: ["Community Management", "Project Management", "Fundraising"], interests: ["Sustainability", "Education"], availability: ["OPEN_TO_COLLABORATE", "OPEN_TO_VOLUNTEER"], experienceLevel: "SENIOR", preferredCollabs: ["VOLUNTEER", "PROJECT_PARTNERSHIP"], languages: ["Portuguese", "English"] });
  const tomas = await person("tomas-ribeiro", "Tomás Ribeiro", { headline: "Teacher & edtech tinkerer", avatarArt: "oculos-terracota", bio: "Physics teacher building quiz games for my students.", location: "Aveiro, Portugal", skills: ["Research", "Python", "Copywriting"], interests: ["Education", "Game Development"], availability: ["LOOKING_FOR_COFOUNDERS", "OPEN_TO_NETWORKING"], experienceLevel: "MID", preferredCollabs: ["COFOUNDER", "ACADEMIC"] });
  const amara = await person("amara-diallo", "Amara Diallo", { headline: "Backend engineer · Go & PostgreSQL", avatarArt: "trancas-e-acafrao", coverArt: "olival-a-hora-azul", bio: "APIs, data modelling and calm on-call rotations.", location: "Lisbon, Portugal", skills: ["Go", "PostgreSQL", "Node.js", "DevOps"], interests: ["Open Source", "Sustainability"], availability: ["OPEN_TO_PAID_WORK", "OPEN_TO_COLLABORATE"], experienceLevel: "SENIOR", preferredWorkModes: ["REMOTE"], preferredCollabs: ["FREELANCE", "PAID"], languages: ["English", "French", "Portuguese"] });
  const lucas = await person("lucas-ferreira", "Lucas Ferreira", { headline: "Embedded engineer · environmental sensors", avatarArt: "chapeu-de-palha", bio: "Low-power sensors for rivers and gardens.", location: "Braga, Portugal", skills: ["Python", "Research", "Data Science"], interests: ["Sustainability", "Hardware"], availability: ["LOOKING_FOR_PROJECTS"], experienceLevel: "MID" });
  const sofia = await person("sofia-marques", "Sofia Marques", { headline: "Illustrator & pixel artist", avatarArt: "flor-de-lavanda", coverArt: "lagoa-ao-amanhecer", bio: "Cozy pixel art for games and community projects.", location: "Porto, Portugal", skills: ["Pixel Art", "Figma", "Design"], interests: ["Game Development", "Education"], availability: ["OPEN_TO_PAID_WORK", "OPEN_TO_COLLABORATE"], experienceLevel: "MID", preferredCollabs: ["FREELANCE"] });
  const kenji = await person("kenji-watanabe", "Kenji Watanabe", { headline: "Audio producer · community radio", avatarArt: "oculos-dourados", bio: "Night Shift Radio: local voices, late hours.", location: "Lisbon, Portugal", skills: ["Content Creation", "Marketing"], interests: ["Media", "Community Management"], availability: ["OPEN_TO_NETWORKING"], experienceLevel: "SENIOR", languages: ["Japanese", "English", "Portuguese"] });
  const ines = await person("ines-carvalho", "Inês Carvalho", { headline: "Product manager · civic tech", bio: "Turning messy public data into services people use.", location: "Lisbon, Portugal", skills: ["Product Management", "Research", "SQL"], interests: ["Education", "Sustainability"], availability: ["HIRING_FREELANCERS"], experienceLevel: "SENIOR" });
  const mateo = await person("mateo-garcia", "Mateo García", { headline: "CS student · learning React", bio: "Second year at university, looking for my first open source contribution.", location: "Salamanca, Spain", skills: ["JavaScript", "React"], interests: ["Open Source", "Game Development"], availability: ["OPEN_TO_VOLUNTEER", "LOOKING_FOR_PROJECTS"], experienceLevel: "BEGINNER", preferredCollabs: ["VOLUNTEER", "INTERNSHIP"], languages: ["Spanish", "English"] });
  const nadia = await person("nadia-benali", "Nadia Benali", { headline: "Founder at Verde Cycle", avatarArt: "apicultora-ambar", coverArt: "costa-ao-entardecer", bio: "Circular economy for neighbourhood shops.", location: "Lisbon, Portugal", skills: ["Business Development", "Sales", "Fundraising"], interests: ["Sustainability", "Fintech"], availability: ["LOOKING_FOR_COFOUNDERS", "HIRING_FREELANCERS"], experienceLevel: "SENIOR", preferredCollabs: ["COFOUNDER", "BUSINESS_PARTNERSHIP"] });
  const rui = await person("rui-teixeira", "Rui Teixeira", { headline: "QA engineer · accessibility tester", bio: "Breaking things kindly so they work for everyone.", location: "Faro, Portugal", skills: ["QA & Testing", "Accessibility"], interests: ["Open Source"], availability: ["OPEN_TO_VOLUNTEER"], experienceLevel: "MID" });
  // One member with an uploaded photo, so the photo path is represented too.
  const ruiPhoto = await upload(rui, await syntheticPortrait(), "avatar", "rui.jpg");
  await updateProfile(rui, { displayName: "Rui Teixeira", headline: "QA engineer · accessibility tester", bio: "Breaking things kindly so they work for everyone.", location: "Faro, Portugal", languages: ["Portuguese", "English"], links: [], availability: ["OPEN_TO_VOLUNTEER"], experienceLevel: "MID", preferredWorkModes: ["REMOTE"], preferredCollabs: ["VOLUNTEER"], skills: ["QA & Testing", "Accessibility"], interests: ["Open Source"], avatarKey: ruiPhoto });

  // ───────── Organizations ─────────
  const studio = await createOrganization(me, {
    name: "Honeycomb Studio", slug: MARKER_ORG, type: "STARTUP", tagline: "Small tools for strong communities", industry: "Design & software", location: "Coimbra", size: "S2_10",
    website: "https://example.com/honeycomb", description: "A tiny studio designing and building open tools for neighbourhoods, schools and makers.", tags: ["Open Source", "Community Management", "Design Systems"],
    logoKey: await upload(me, await png(logoSvg("HS", "#352217", "#ffc44c")), "logo"), coverKey: await upload(me, brand("capas/estufa-de-azulejos.webp"), "cover"),
  });
  const guild = await createOrganization(helena, { name: "Coimbra Makers Guild", slug: "coimbra-makers", type: "COMMUNITY", tagline: "Repair, build and learn together", location: "Coimbra", size: "S51_200", description: "Weekly workshops, repair cafés and open hardware nights.", tags: ["Sustainability", "Education"], logoKey: await upload(helena, await png(logoSvg("CM", "#214e4a", "#82c3ae")), "logo") });
  const verde = await createOrganization(nadia, { name: "Verde Cycle", slug: "verde-cycle", type: "STARTUP", tagline: "Circular packaging for local shops", industry: "Sustainability", location: "Lisbon", size: "S2_10", website: "https://example.com/verde", tags: ["Sustainability", "E-commerce"], logoKey: await upload(nadia, await png(logoSvg("VC", "#3b6a2a", "#e6f0cf")), "logo") });

  // ───────── Projects ─────────
  const hiveMap = await createProject(me, {
    name: "Hive Map", slug: "hive-map", summary: "An open map of community resources: repair cafés, food banks, study rooms and makerspaces.",
    description: "Hive Map collects neighbourhood resources from local groups and shows them on an accessible, offline-friendly map. Groups update their own entries; everyone can suggest new ones.",
    goals: "Cover Coimbra and Aveiro by summer, then open the data API.", needs: "Backend help for the API, icon illustration, and testers who use screen readers.",
    category: "SOCIAL_IMPACT", stage: "MVP", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, organizationId: studio.id,
    repoUrl: "https://example.com/hive-map/repo", tech: ["React", "TypeScript", "Node.js", "PostgreSQL"], topics: ["Sustainability", "Community Management"],
    logoKey: await upload(me, await png(logoSvg("HM", "#ffc44c", "#352217")), "logo"), coverKey: await upload(me, brand("capas/lagoa-ao-amanhecer.webp"), "cover"),
  });
  await addProjectImage(me, hiveMap.id, await upload(me, brand("capas/costa-ao-entardecer.webp"), "gallery"), "Coastal neighbourhood layer");
  await addProjectImage(me, hiveMap.id, await upload(me, readFileSync(path.join(ROOT, "tests/e2e/fixtures/pixel-garden.webp")), "gallery"), "Community garden pin artwork");
  const mel = await createProject(me, { name: "Mel Design System", slug: "mel-design-system", summary: "Accessible React components and tokens for community tools.", description: "Buttons, forms, maps and cards with AA contrast, keyboard support and pixel-friendly theming.", category: "DEVTOOLS", stage: "IN_DEVELOPMENT", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, organizationId: studio.id, tech: ["React", "TypeScript", "Storybook"], topics: ["Accessibility", "Design Systems"] });
  await createProject(me, { name: "Secret Garden Prototype", slug: "secret-garden-prototype", summary: "A private experiment: a garden-planning game for schools.", category: "GAMES", stage: "IDEA", visibility: "PRIVATE", isOpenSource: false, acceptsBeginners: false, tech: [], topics: ["Education", "Game Development"] });
  const bairro = await createProject(nadia, { name: "Bairro Market", slug: "bairro-market", summary: "Pre-orders and refillable packaging for neighbourhood shops.", category: "ECOMMERCE", stage: "PROTOTYPE", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, organizationId: verde.id, tech: ["Next.js", "PostgreSQL"], topics: ["Sustainability", "E-commerce"], coverKey: await upload(nadia, brand("capas/costa-ao-entardecer.webp"), "cover") });
  const pollen = await createProject(tomas, { name: "Pollen Quiz", slug: "pollen-quiz", summary: "Science quizzes as a cooperative classroom game.", category: "EDUCATION", stage: "PLANNING", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, tech: ["Python", "React"], topics: ["Education", "Game Development"] });
  const radio = await createProject(kenji, { name: "Night Shift Radio", slug: "night-shift-radio", summary: "A community radio for late-shift workers, with local stories and music.", category: "MEDIA", stage: "LAUNCHED", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: true, tech: [], topics: ["Media", "Community Management"] });
  const river = await createProject(lucas, { name: "Rivertrack Sensors", slug: "rivertrack-sensors", summary: "Open, low-cost sensors that log river water quality.", category: "HARDWARE", stage: "PROTOTYPE", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: false, tech: ["Python", "C"], topics: ["Sustainability", "Hardware"] });
  const recipes = await createProject(sofia, { name: "Open Recipes Atlas", slug: "open-recipes-atlas", summary: "Illustrated family recipes from every neighbourhood.", category: "OPEN_SOURCE", stage: "IDEA", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, tech: [], topics: ["Education", "Community Management"] });

  // Teams: the account joins two projects; one invitation stays pending for review.
  await quiet(async () => {
    const a = await inviteToProject(nadia, bairro.id, { username: me.username, role: "EDITOR", title: "Product designer" });
    await respondToInvitation(me, a.id, true);
    const b = await inviteToProject(tomas, pollen.id, { username: me.username, role: "MEMBER", title: "UX advisor" });
    await respondToInvitation(me, b.id, true);
    await inviteToProject(sofia, recipes.id, { username: me.username, role: "MEMBER", title: "Front-end developer" });
    const c = await inviteToProject(me, hiveMap.id, { username: "amara-diallo", role: "MEMBER", title: "Backend developer" });
    await respondToInvitation(amara, c.id, true);
    const d = await inviteToProject(me, hiveMap.id, { username: "rui-teixeira", role: "MEMBER", title: "Accessibility tester" });
    await respondToInvitation(rui, d.id, true);
    const e = await inviteToProject(me, mel.id, { username: "sofia-marques", role: "MEMBER", title: "Icon illustrator" });
    await respondToInvitation(sofia, e.id, true);
  });

  // ───────── Opportunities ─────────
  const base = { location: undefined, experienceLevel: undefined, duration: undefined, commitment: undefined, compensation: undefined, deadline: undefined, topics: [] as string[], publish: true };
  const apiOpp = await quiet(() => createOpportunity(me, { ...base, owner: `project:${hiveMap.id}`, position: "backend-developer", title: "Backend developer for the Hive Map API", description: "Design and build the public read API (Node.js + PostgreSQL): pagination, caching and a clean data model for community resources. Pairing sessions every week.", category: "ENGINEERING", collaborationType: "VOLUNTEER", workMode: "REMOTE", experienceLevel: "JUNIOR", commitment: "FEW_HOURS", duration: "MEDIUM_TERM", compensationType: "NONE", skills: ["Node.js", "PostgreSQL", "Backend"], topics: ["Open Source", "Sustainability"] }));
  const iconOpp = await quiet(() => createOpportunity(me, { ...base, owner: `project:${hiveMap.id}`, position: "illustrator", title: "Illustrator for 30 map icons", description: "Pixel-friendly icons for resource types (repair café, food bank, library…), delivered as SVG in two sizes.", category: "DESIGN", collaborationType: "FREELANCE", workMode: "REMOTE", experienceLevel: "MID", duration: "SHORT_TERM", compensationType: "FIXED", compensation: "€900", skills: ["Design", "Pixel Art"], topics: ["Community Management"] }));
  const a11yOpp = await quiet(() => createOpportunity(me, { ...base, owner: `project:${mel.id}`, position: "accessibility-tester", title: "Screen-reader testers for Mel components", description: "Test our components with NVDA, VoiceOver or TalkBack and report what gets in the way.", category: "TESTING_QA", collaborationType: "VOLUNTEER", workMode: "REMOTE", compensationType: "NONE", commitment: "FLEXIBLE", skills: ["Accessibility", "QA & Testing"], topics: ["Accessibility"] }));
  await quiet(() => createOpportunity(me, { ...base, owner: `org:${studio.id}`, position: "react-developer", title: "Part-time front-end developer (React)", description: "Join Honeycomb Studio two days a week to build community tools with us.", category: "ENGINEERING", collaborationType: "PAID", workMode: "HYBRID", location: "Coimbra", experienceLevel: "MID", commitment: "PART_TIME", duration: "LONG_TERM", compensationType: "SALARY", compensation: "€1,400/month (part-time)", skills: ["React", "TypeScript"], topics: ["Open Source"] }));
  await quiet(() => createOpportunity(me, { ...base, publish: false, owner: `project:${mel.id}`, position: "technical-writer", title: "Documentation writer (draft)", description: "Draft opportunity: write usage guides for Mel components.", category: "CONTENT", collaborationType: "FREELANCE", workMode: "REMOTE", compensationType: "NEGOTIABLE", skills: ["Copywriting"], topics: [] }));
  const quizOpp = await quiet(() => createOpportunity(tomas, { ...base, owner: `project:${pollen.id}`, position: "ux-designer", title: "UX designer for a classroom game", description: "Help us shape a cooperative quiz game teachers can run in 10 minutes.", category: "DESIGN", collaborationType: "PROJECT_PARTNERSHIP", workMode: "REMOTE", compensationType: "NONE", skills: ["UI/UX", "Figma"], topics: ["Education"] }));
  const verdeOpp = await quiet(() => createOpportunity(nadia, { ...base, owner: `org:${verde.id}`, position: "agency-studio-partner", title: "Design partner for refill packaging labels", description: "We need a studio to design labels and a tiny web flow for returns.", category: "PARTNERSHIP", collaborationType: "BUSINESS_PARTNERSHIP", workMode: "HYBRID", location: "Lisbon", compensationType: "NEGOTIABLE", skills: ["Design", "Business Development"], topics: ["Sustainability"] }));
  await quiet(() => createOpportunity(kenji, { ...base, owner: `project:${radio.id}`, position: "podcast-producer", title: "Weekend co-host (Portuguese / English)", description: "Two hours on Saturday nights, talking with local guests.", category: "CONTENT", collaborationType: "VOLUNTEER", workMode: "ONSITE", location: "Lisbon", compensationType: "NONE", skills: ["Content Creation"], topics: ["Media"] }));
  await quiet(() => createOpportunity(lucas, { ...base, owner: `project:${river.id}`, position: "data-scientist", title: "Data scientist for water-quality anomalies", description: "Find sensor faults vs. real pollution events in a year of readings.", category: "RESEARCH", collaborationType: "ACADEMIC", workMode: "REMOTE", experienceLevel: "SENIOR", compensationType: "STIPEND", compensation: "€300/month stipend", skills: ["Data Science", "Python"], topics: ["Sustainability"] }));
  await quiet(() => createOpportunity(ines, { ...base, owner: "user", position: "user-researcher", title: "Freelance researcher for a library survey", description: "Interview 15 librarians about digital services; synthesis in a short report.", category: "RESEARCH", collaborationType: "FREELANCE", workMode: "REMOTE", compensationType: "HOURLY", compensation: "€25/hour", skills: ["Research"], topics: ["Education"] }));

  // ───────── Applications (sent and received) ─────────
  await quiet(async () => {
    const mine = await applyToOpportunity(me, { opportunityId: quizOpp.id, message: "I've run usability tests with teachers before and would love to help shape the game loop.", portfolioUrl: "https://example.com/iinu" });
    await updateApplicationStatus(tomas, mine.id, "CONTACTED", { note: "Call on Thursday" });
    await applyToOpportunity(me, { opportunityId: verdeOpp.id, organizationId: studio.id, message: "Honeycomb Studio could design the labels and the returns flow together." });
    const m1 = await applyToOpportunity(mateo, { opportunityId: apiOpp.id, message: "I'm learning Node and would love a first open source contribution with mentoring." });
    await updateApplicationStatus(me, m1.id, "IN_REVIEW", { note: "Pair on a small endpoint first" });
    const m2 = await applyToOpportunity(amara, { opportunityId: apiOpp.id, message: "Happy to design the data model and review PRs." });
    await updateApplicationStatus(me, m2.id, "ACCEPTED", { note: "Welcome aboard" });
    await applyToOpportunity(sofia, { opportunityId: iconOpp.id, message: "Here are some pixel icon sets I made for games and maps.", portfolioUrl: "https://example.com/sofia" });
    const m3 = await applyToOpportunity(rui, { opportunityId: a11yOpp.id, message: "I test with NVDA and TalkBack daily." });
    await updateApplicationStatus(me, m3.id, "ACCEPTED");
    if (bruno) {
      const m4 = await applyToOpportunity(bruno, { opportunityId: iconOpp.id, message: "I'm not an illustrator but I'd like to try!" });
      await updateApplicationStatus(me, m4.id, "REJECTED", { note: "Looking for an experienced illustrator this time" });
    }
  });

  // ───────── Network: connections (accepted and pending) and follows ─────────
  await quiet(async () => {
    for (const other of [helena, tomas, amara, lucas, ...(ana ? [ana] : []), ...(diogo ? [diogo] : [])]) {
      await sendConnectionRequest(other, me.id);
      await respondToConnectionRequest(me, other.id, true);
    }
    await sendConnectionRequest(sofia, me.id, "Loved Hive Map! Would be great to connect.");
    await sendConnectionRequest(mateo, me.id, "Hi! I applied to the API role — happy to connect.");
    await sendConnectionRequest(me, kenji.id, "Big fan of Night Shift Radio.");
    await sendConnectionRequest(helena, amara.id);
    await respondToConnectionRequest(amara, helena.id, true);
    await sendConnectionRequest(nadia, ines.id);
    await respondToConnectionRequest(ines, nadia.id, true);
    for (const fan of [helena, kenji, nadia, rui, ines, mateo, ...(ana ? [ana] : []), ...(bruno ? [bruno] : []), ...(carla ? [carla] : [])]) await follow(fan, { userId: me.id });
    for (const target of [kenji, ines, ...(farid ? [farid] : []), ...(grace ? [grace] : [])]) await follow(me, { userId: target.id });
    await follow(me, { projectId: radio.id });
    await follow(me, { projectId: river.id });
    await follow(me, { organizationId: guild.id });
    for (const fan of [mateo, rui, helena, lucas]) await follow(fan, { projectId: hiveMap.id });
    await follow(nadia, { organizationId: studio.id });
  });

  // ───────── Partnerships ─────────
  const pa = await requestPartnership(me, { projectId: hiveMap.id }, { projectId: bairro.id }, "Shops on Bairro Market could appear on Hive Map with refill points.");
  await respondToPartnership(nadia, pa.id, true);
  await requestPartnership(lucas, { projectId: river.id }, { projectId: hiveMap.id }, "Show live river readings as a Hive Map layer?");
  await requestPartnership(me, { organizationId: studio.id }, { organizationId: guild.id }, "Co-host a monthly 'fix the map' evening at the guild?");

  // ───────── Posts, images, comments, likes, saves and shares ─────────
  await quiet(async () => {
    const p1 = await createPost(me, { actingAs: "user", type: "LAUNCH", body: "Hive Map MVP is live in Coimbra! 120 community resources, offline mode and full keyboard support. Thanks @amara-diallo and @rui-teixeira for the last sprint. #OpenSource #Accessibility", imageKeys: [await upload(me, brand("capas/lagoa-ao-amanhecer.webp"), "post")] });
    const p2 = await createPost(me, { actingAs: `project:${mel.id}`, type: "PROJECT_UPDATE", body: "Mel 0.4: new map card, focus rings that survive every theme, and a pixel icon set by @sofia-marques. #DesignSystems", imageKeys: [await upload(me, brand("capas/estufa-de-azulejos.webp"), "post"), await upload(me, readFileSync(path.join(ROOT, "tests/e2e/fixtures/pixel-garden.webp")), "post")] });
    const p3 = await createPost(me, { actingAs: "user", type: "HELP_REQUEST", body: "Has anyone tested map apps with screen-reader users in a workshop format? Looking for a facilitation guide. #Accessibility #Education", imageKeys: [] });
    const p4 = await createPost(me, { actingAs: "user", type: "DISCUSSION", body: "Hot take: most community websites need fewer features and better opening hours. What would you remove first?", imageKeys: [] });
    const p5 = await createPost(me, { actingAs: "user", type: "ACHIEVEMENT", body: "Hive Map was selected for the Coimbra civic tech grant. Next stop: Aveiro! #Sustainability", linkUrl: "https://example.com/hive-map/news", imageKeys: [] });
    const p6 = await createPost(me, { actingAs: `org:${studio.id}`, type: "TEXT", body: "Studio notes: we're opening two seats for paid part-time front-end work. See our opportunities page.", imageKeys: [await upload(me, brand("capas/costa-ao-entardecer.webp"), "post")] });

    const o1 = await createPost(helena, { actingAs: `org:${guild.id}`, type: "PROJECT_UPDATE", body: "Repair café this Saturday: bring your broken lamps and toasters. 14 volunteers signed up already! #Sustainability", imageKeys: [await upload(helena, brand("capas/olival-a-hora-azul.webp"), "post")] });
    const o2 = await createPost(tomas, { actingAs: "user", type: "DISCUSSION", body: "Teachers: would you use a 10-minute cooperative quiz at the end of class? Why or why not? #Education", imageKeys: [] });
    const o3 = await createPost(kenji, { actingAs: `project:${radio.id}`, type: "LAUNCH", body: "Night Shift Radio is on air every night from 23:00. Tell us which local stories we should cover!", imageKeys: [] });
    const o4 = await createPost(nadia, { actingAs: "user", type: "PARTNERSHIP", body: "Bairro Market × Hive Map: refill points are now on the map. Thanks @" + me.username + "!", imageKeys: [] });
    const o5 = await createPost(lucas, { actingAs: `project:${river.id}`, type: "PROJECT_UPDATE", body: "First month of readings from the Mondego: the sensors survived the storm. #OpenSource #Sustainability", imageKeys: [] });
    const o6 = await createPost(sofia, { actingAs: "user", type: "TEXT", body: "Sketching 30 tiny icons for community places. Which one is the hardest: library, food bank or repair café?", imageKeys: [await upload(sofia, readFileSync(path.join(ROOT, "tests/e2e/fixtures/pixel-garden.webp")), "post")] });
    const o7 = await createPost(mateo, { actingAs: "user", type: "HELP_REQUEST", body: "First open source PR in review 😅 Any tips for handling review comments gracefully?", imageKeys: [] });

    for (const [post, fans] of [[p1, [helena, amara, rui, nadia, kenji, mateo]], [p2, [sofia, amara, ines]], [p3, [rui, tomas]], [p4, [helena, ines, kenji, lucas]], [p5, [helena, nadia, tomas, amara, lucas]], [o1, [me, lucas]], [o3, [me, helena]], [o4, [me]], [o6, [me, mateo]]] as const) {
      for (const fan of fans) await toggleLike(fan, post.id);
    }
    const c1 = await addComment(helena, { postId: p1.id, body: "Congratulations! Can the guild add our workshop schedule?" });
    await addComment(me, { postId: p1.id, parentId: c1.id, body: "Yes! @helena-sousa I'll send you an editor invite this week." });
    await addComment(rui, { postId: p3.id, body: "I have a 2-hour workshop plan; sending it over DM." });
    await addComment(ines, { postId: p4.id, body: "Remove the newsletter popup. Always." });
    await addComment(kenji, { postId: p4.id, body: "Opening hours that are actually true 🙏" });
    await addComment(me, { postId: o2.id, body: "Yes — if it works without student accounts." });
    await addComment(me, { postId: o7.id, body: "Thank the reviewer, ask questions, small follow-up commits. You've got this!" });
    await toggleSave(me, o1.id);
    await toggleSave(me, o5.id);
    await toggleSave(me, o6.id);
    const share = await createPost(me, { actingAs: "user", type: "TEXT", body: "", repostOfId: o4.id, imageKeys: [] });
    const quote = await createPost(me, { actingAs: "user", type: "TEXT", body: "Love seeing open hardware in the wild 💧", repostOfId: o5.id, imageKeys: [] });

    const ages: [{ id: string }, number][] = [[p1, 2], [p2, 6], [p3, 9], [p4, 12], [p5, 18], [p6, 21], [o1, 1], [o2, 3], [o3, 5], [o4, 4], [o5, 7], [o6, 8], [o7, 10], [share, 3.5], [quote, 6.5]];
    for (const [post, d] of ages) await backdate(post.id, d);
  });

  // ───────── Conversations ─────────
  await quiet(async () => {
    const c1 = await startConversation(helena, me.id);
    await sendMessage(helena, c1, "Hi! The guild would love to add our workshops to Hive Map.");
    await sendMessage(me, c1, "Amazing — I'll set you up as an editor for the Coimbra layer.");
    await sendMessage(helena, c1, "Perfect. Could we also print a poster with the QR code?");
    await sendMessage(me, c1, "Sure, Sofia can help with the illustration.");
    const c2 = await startConversation(me, tomas.id);
    await sendMessage(me, c2, "Thanks for the call! Sharing my notes on the game loop tomorrow.");
    await sendMessage(tomas, c2, "Great, the class is excited to test it.");
    const c3 = await startConversation(amara, me.id);
    await sendMessage(amara, c3, "Pushed a first draft of the API schema — can you review when you have a minute?");
  });

  const counts = await db.$transaction([db.user.count(), db.organization.count(), db.project.count(), db.opportunity.count(), db.post.count(), db.application.count(), db.connection.count(), db.follow.count(), db.message.count(), db.notification.count()]);
  console.log(`Placeholder data ready for @${me.username}. Totals — users ${counts[0]}, organizations ${counts[1]}, projects ${counts[2]}, opportunities ${counts[3]}, posts ${counts[4]}, applications ${counts[5]}, connections ${counts[6]}, follows ${counts[7]}, messages ${counts[8]}, notifications ${counts[9]}.`);
  console.log(`New placeholder accounts sign in with <username>@placeholder.collabhub.local / ${PASSWORD}.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
