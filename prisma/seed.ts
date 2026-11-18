/**
 * Demo data: people, organizations, projects, opportunities, applications, posts,
 * connections, partnerships and a conversation. Built through the service layer so
 * every invariant, counter and notification is created exactly as in production.
 *
 *   npm run db:seed            (skips if demo data already exists)
 *
 * All demo accounts use the password "collab-demo-2026".
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { signup } from "../src/server/auth/service";
import type { Actor } from "../src/server/auth/types";
import { updateProfile } from "../src/server/profiles";
import { createOrganization } from "../src/server/organizations";
import { createProject } from "../src/server/projects";
import { createOpportunity } from "../src/server/opportunities";
import { applyToOpportunity, updateApplicationStatus } from "../src/server/applications";
import { follow, respondToConnectionRequest, sendConnectionRequest } from "../src/server/social/graph";
import { addComment, createPost, toggleLike } from "../src/server/posts";
import { requestPartnership, respondToPartnership } from "../src/server/partnerships";
import { inviteToProject, respondToInvitation } from "../src/server/invitations";
import { sendMessage, startConversation } from "../src/server/messaging";

const PASSWORD = "collab-demo-2026";

type P = Parameters<typeof updateProfile>[1];

async function person(username: string, displayName: string, profile: Partial<P>, role: "USER" | "MODERATOR" | "ADMIN" = "USER"): Promise<Actor> {
  const u = await signup({ displayName, username, email: `${username}@demo.collabhub.local`, password: PASSWORD }, { ip: `seed-${username}` });
  await db.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date(), role } });
  const actor: Actor = { id: u.id, username, role, status: "ACTIVE", emailVerified: true };
  await updateProfile(actor, {
    displayName,
    languages: ["English"],
    links: [],
    availability: [],
    preferredWorkModes: [],
    preferredCollabs: [],
    skills: [],
    interests: [],
    ...profile,
  });
  return actor;
}

async function main() {
  if (await db.user.findUnique({ where: { username: "ana" } })) {
    console.log("Demo data already present – skipping. Run `npm run db:reset` to start over.");
    return;
  }
  // Rate limits are per subject; the seed creates a burst of activity from few accounts.
  const quiet = async <T>(fn: () => Promise<T>) => {
    await db.rateLimit.deleteMany({});
    return fn();
  };

  // Catalog art (public/brand/colmeia) for most demo members; carla and morgan keep the default look.
  const admin = await person("morgan", "Morgan Silva", { headline: "Community moderation" }, "ADMIN");
  const ana = await person("ana", "Ana Ribeiro", {
    headline: "Full-stack developer · building AI tools for students",
    avatarArt: "apicultora-ambar",
    coverArt: "costa-ao-entardecer",
    bio: "I build learning tools with Python and React. Founder of Nova Labs. Looking for people who care about education.",
    location: "Lisbon, Portugal",
    skills: ["Python", "React", "TypeScript", "Machine Learning", "Product Management"],
    interests: ["Education", "Artificial Intelligence", "Open Source"],
    availability: ["LOOKING_FOR_COFOUNDERS", "OPEN_TO_NETWORKING"],
    experienceLevel: "SENIOR",
    preferredWorkModes: ["REMOTE", "HYBRID"],
    preferredCollabs: ["COFOUNDER", "PROJECT_PARTNERSHIP"],
    languages: ["Portuguese", "English"],
    links: [{ label: "GitHub", url: "https://github.com" }],
  });
  const bruno = await person("bruno", "Bruno Costa", {
    headline: "Computer Science student · frontend enthusiast",
    avatarArt: "chapeu-de-palha",
    bio: "Second-year CS student. I love building interfaces and want real project experience.",
    location: "Porto, Portugal",
    skills: ["React", "TypeScript", "Frontend", "UI/UX", "CSS"],
    interests: ["Artificial Intelligence", "Education", "Game Development"],
    availability: ["OPEN_TO_VOLUNTEER", "LOOKING_FOR_PROJECTS", "OPEN_TO_COLLABORATE"],
    experienceLevel: "BEGINNER",
    preferredWorkModes: ["REMOTE"],
    preferredCollabs: ["VOLUNTEER", "INTERNSHIP", "ACADEMIC"],
  });
  const carla = await person("carla", "Carla Mendes", {
    headline: "Growth marketer · freelance",
    bio: "I help early-stage products find their first 1,000 users.",
    location: "Lisbon, Portugal",
    skills: ["Marketing", "Growth Marketing", "SEO", "Copywriting", "Content Creation"],
    interests: ["Education", "Fintech"],
    availability: ["OPEN_TO_PAID_WORK"],
    experienceLevel: "MID",
    preferredCollabs: ["FREELANCE", "PAID"],
  });
  const diogo = await person("diogo", "Diogo Alves", {
    headline: "Product & game designer",
    avatarArt: "oculos-dourados",
    coverArt: "estufa-de-azulejos",
    bio: "Designing playful interfaces. Currently making Pixel Garden.",
    location: "Braga, Portugal",
    skills: ["UI/UX", "Figma", "Game Development", "Design"],
    interests: ["Game Development", "Education"],
    availability: ["HIRING_FREELANCERS", "OPEN_TO_COLLABORATE"],
    experienceLevel: "MID",
  });
  const elena = await person("elena", "Elena Rossi", {
    headline: "Head of Partnerships at Greenleaf Retail",
    avatarArt: "flor-de-lavanda",
    coverArt: "lagoa-ao-amanhecer",
    location: "Madrid, Spain",
    skills: ["Business Development", "Sales", "Partnerships"],
    interests: ["Fintech", "Sustainability"],
    availability: ["OPEN_TO_NETWORKING"],
    experienceLevel: "SENIOR",
  });
  const farid = await person("farid", "Farid Haddad", {
    headline: "Backend & DevOps engineer · open source maintainer",
    avatarArt: "bandana-verde",
    coverArt: "olival-a-hora-azul",
    bio: "Go, Kubernetes and boring, reliable infrastructure. Maintainer of OpenHarbor.",
    location: "Porto, Portugal",
    skills: ["Go", "Kubernetes", "PostgreSQL", "Backend", "DevOps"],
    interests: ["Open Source", "Developer Tools"],
    availability: ["LOOKING_FOR_COFOUNDERS", "OPEN_TO_PAID_WORK", "OPEN_TO_COLLABORATE"],
    experienceLevel: "EXPERT",
    preferredCollabs: ["COFOUNDER", "FREELANCE", "PROJECT_PARTNERSHIP"],
  });
  const grace = await person("grace", "Grace Okafor", {
    headline: "Data scientist · mentor",
    avatarArt: "trancas-e-acafrao",
    skills: ["Python", "Data Science", "Machine Learning"],
    interests: ["Education", "Artificial Intelligence"],
    availability: ["OPEN_TO_NETWORKING", "OPEN_TO_VOLUNTEER"],
    experienceLevel: "EXPERT",
    preferredCollabs: ["MENTORSHIP"],
  });

  // Organizations
  const nova = await createOrganization(ana, { name: "Nova Labs", slug: "nova-labs", type: "STARTUP", tagline: "Learning tools that adapt to every student", industry: "Education technology", location: "Lisbon", size: "S2_10", website: "https://example.com", description: "Nova Labs builds AI-assisted study tools with teachers and students.", tags: ["Education", "Artificial Intelligence"] });
  const greenleaf = await createOrganization(elena, { name: "Greenleaf Retail", slug: "greenleaf-retail", type: "COMPANY", tagline: "Sustainable groceries across Iberia", industry: "Retail", location: "Madrid", size: "S201_1000", tags: ["Sustainability", "E-commerce"] });
  const portoDev = await createOrganization(farid, { name: "Porto Dev Community", slug: "porto-dev", type: "COMMUNITY", tagline: "Meetups and open source for developers in Porto", location: "Porto", size: "S51_200", tags: ["Open Source", "Developer Tools"] });

  // Projects
  const studyPilot = await createProject(ana, {
    name: "StudyPilot", slug: "studypilot", summary: "An AI study assistant that turns class notes into personalized practice.",
    description: "StudyPilot reads your notes and generates spaced-repetition quizzes. The model works; now we need a great web experience and a launch plan.",
    goals: "Pilot with 3 schools in Lisbon by spring.", needs: "Frontend development, marketing for the school pilot, QA.",
    category: "AI_ML", stage: "PROTOTYPE", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, organizationId: nova.id,
    repoUrl: "https://github.com", tech: ["Python", "PyTorch", "React", "TypeScript"], topics: ["Education", "Artificial Intelligence"],
  });
  const pixel = await createProject(diogo, { name: "Pixel Garden", slug: "pixel-garden", summary: "A cozy pixel-art game about growing a community garden.", category: "GAMES", stage: "IN_DEVELOPMENT", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, tech: ["Unity", "C#"], topics: ["Game Development"] });
  const harbor = await createProject(farid, { name: "OpenHarbor", slug: "openharbor", summary: "Self-hosted deployment dashboard for small teams on Kubernetes.", category: "DEVTOOLS", stage: "MVP", visibility: "PUBLIC", isOpenSource: true, acceptsBeginners: true, organizationId: portoDev.id, repoUrl: "https://github.com", tech: ["Go", "Kubernetes", "React"], topics: ["Open Source", "Developer Tools"] });
  await createProject(elena, { name: "Greenleaf Pay Pilot", slug: "greenleaf-pay", summary: "Piloting rewards for sustainable purchases at checkout.", category: "FINTECH", stage: "PLANNING", visibility: "PUBLIC", isOpenSource: false, acceptsBeginners: false, organizationId: greenleaf.id, tech: [], topics: ["Fintech", "Sustainability"] });

  // Teams
  const inv = await inviteToProject(ana, studyPilot.id, { username: "grace", role: "EDITOR", title: "ML mentor" });
  await respondToInvitation(grace, inv.id, true);
  await quiet(() => inviteToProject(farid, harbor.id, { username: "diogo", role: "MEMBER", title: "UI designer" }));

  // Opportunities
  const base = { location: undefined, experienceLevel: undefined, duration: undefined, commitment: undefined, compensation: undefined, deadline: undefined, topics: [] as string[], publish: true };
  const feOpp = await createOpportunity(ana, { ...base, owner: `project:${studyPilot.id}`, position: "frontend-developer", title: "Frontend developer for our study assistant", description: "Build the web app that students use every day: React + TypeScript, accessible and fast. Mentorship from our senior devs and a real pilot with schools. Students welcome!", category: "ENGINEERING", collaborationType: "VOLUNTEER", workMode: "REMOTE", experienceLevel: "BEGINNER", commitment: "FEW_HOURS", duration: "MEDIUM_TERM", compensationType: "NONE", skills: ["React", "TypeScript", "Frontend"], topics: ["Education", "Artificial Intelligence"] });
  const mktOpp = await createOpportunity(ana, { ...base, owner: `project:${studyPilot.id}`, position: "digital-marketing-specialist", title: "Marketing specialist for school pilot launch", description: "Plan and run the launch of our pilot with three schools: messaging, landing page copy and outreach to teachers.", category: "MARKETING", collaborationType: "FREELANCE", workMode: "HYBRID", location: "Lisbon", experienceLevel: "MID", duration: "SHORT_TERM", compensationType: "FIXED", compensation: "€2,500 fixed", skills: ["Marketing", "Growth Marketing", "Copywriting"], topics: ["Education"] });
  await createOpportunity(ana, { ...base, owner: `org:${nova.id}`, position: "technical-co-founder", title: "Technical co-founder (backend & infrastructure)", description: "Nova Labs is looking for a technical co-founder to own our backend and infrastructure as we scale from pilot to product. Equity-based.", category: "ENGINEERING", collaborationType: "COFOUNDER", workMode: "HYBRID", location: "Lisbon or Porto", experienceLevel: "SENIOR", compensationType: "EQUITY", compensation: "Meaningful equity", skills: ["Backend", "PostgreSQL", "DevOps"], topics: ["Education"] });
  const partnerOpp = await createOpportunity(elena, { ...base, owner: `org:${greenleaf.id}`, position: "business-partner", title: "Commercial partner for a sustainable payments pilot", description: "We want a fintech or startup partner to co-run a rewards pilot in 20 stores.", category: "PARTNERSHIP", collaborationType: "BUSINESS_PARTNERSHIP", workMode: "REMOTE", compensationType: "NEGOTIABLE", skills: ["Business Development", "Fintech"], topics: ["Sustainability"] });
  await createOpportunity(farid, { ...base, owner: `project:${harbor.id}`, position: "beta-tester", title: "Testing assistance for our 1.0 release", description: "Help us test OpenHarbor on real clusters and report bugs before 1.0. Great first open source contribution.", category: "TESTING_QA", collaborationType: "VOLUNTEER", workMode: "REMOTE", experienceLevel: "JUNIOR", compensationType: "NONE", skills: ["QA & Testing", "Kubernetes"], topics: ["Open Source"] });
  await createOpportunity(diogo, { ...base, owner: `project:${pixel.id}`, position: "pixel-artist", title: "Pixel artist for character sprites", description: "Freelance pixel artist for ~40 character sprites with idle and walk animations.", category: "DESIGN", collaborationType: "FREELANCE", workMode: "REMOTE", compensationType: "FIXED", compensation: "€1,200", skills: ["Pixel Art", "Design"], topics: ["Game Development"] });
  await createOpportunity(grace, { ...base, owner: "user", position: "mentor", title: "Mentoring students who want to get into ML", description: "I have a few hours a month to mentor students working on machine learning projects.", category: "RESEARCH", collaborationType: "MENTORSHIP", workMode: "REMOTE", compensationType: "NONE", skills: ["Machine Learning", "Python"], topics: ["Education"] });

  // Applications (Scenario A & C)
  const brunoApp = await quiet(() => applyToOpportunity(bruno, { opportunityId: feOpp.id, message: "I'm a CS student who has built two React projects for class. I'd love to help build StudyPilot's interface and learn from your team.", portfolioUrl: "https://example.com/bruno" }));
  await updateApplicationStatus(ana, brunoApp.id, "IN_REVIEW", { note: "Strong portfolio" });
  await applyToOpportunity(carla, { opportunityId: mktOpp.id, message: "I've launched three edtech products in Portugal and know how to reach teachers. Happy to share case studies." });
  await applyToOpportunity(ana, { opportunityId: partnerOpp.id, organizationId: nova.id, message: "Nova Labs could bring our rewards engine to your pilot — let's talk." });

  // Network (Scenario D)
  await quiet(async () => {
    await sendConnectionRequest(ana, diogo.id);
    await respondToConnectionRequest(diogo, ana.id, true);
    await sendConnectionRequest(farid, ana.id);
    await respondToConnectionRequest(ana, farid.id, true);
    await sendConnectionRequest(bruno, diogo.id);
    await respondToConnectionRequest(diogo, bruno.id, true);
    await sendConnectionRequest(grace, ana.id);
    await respondToConnectionRequest(ana, grace.id, true);
    await sendConnectionRequest(carla, ana.id, "Hi Ana, I'd love to connect — I work with edtech startups.");
    await follow(bruno, { projectId: studyPilot.id });
    await follow(bruno, { projectId: harbor.id });
    await follow(carla, { organizationId: nova.id });
    await follow(elena, { userId: ana.id });
    await follow(grace, { projectId: studyPilot.id });
  });

  // Partnerships (Scenario G)
  const p1 = await requestPartnership(ana, { projectId: studyPilot.id }, { projectId: harbor.id }, "OpenHarbor could host our pilot deployments; we can contribute an education template.");
  await respondToPartnership(farid, p1.id, true);
  await requestPartnership(diogo, { projectId: pixel.id }, { projectId: studyPilot.id }, "Gamified study sessions? Our art + your engine.");

  // Posts & interactions (Scenario F)
  await quiet(async () => {
    const update = await createPost(ana, { actingAs: `project:${studyPilot.id}`, type: "PROJECT_UPDATE", body: "Our quiz generator now handles handwritten notes! Huge thanks to @grace for the model review. Next: a web app that students actually enjoy. #AI #Education", imageKeys: [] });
    await toggleLike(bruno, update.id);
    await toggleLike(farid, update.id);
    await toggleLike(grace, update.id);
    const c = await addComment(bruno, { postId: update.id, body: "This is great! I applied for the frontend role." });
    await addComment(ana, { postId: update.id, parentId: c.id, body: "Thanks @bruno — we'll be in touch this week." });
    await createPost(farid, { actingAs: "user", type: "LAUNCH", body: "OpenHarbor 0.9 is out: one-click rollbacks and a much faster dashboard. Looking for testers before 1.0 — see the opportunity on the project page. #OpenSource #Kubernetes", imageKeys: [] });
    await createPost(diogo, { actingAs: "user", type: "HELP_REQUEST", body: "Designers: how do you run usability tests for games with kids? Looking for advice and templates. #Design #GameDevelopment", imageKeys: [] });
    const partnership = await createPost(farid, { actingAs: `project:${harbor.id}`, type: "PARTNERSHIP", body: "We're now partners with @studypilot! OpenHarbor will power their school pilot deployments.", imageKeys: [] });
    await createPost(ana, { actingAs: "user", type: "TEXT", body: "", repostOfId: partnership.id, imageKeys: [] });
    await createPost(carla, { actingAs: "user", type: "DISCUSSION", body: "What's the most effective channel you've seen for reaching teachers? Newsletters, conferences, or Facebook groups? #Education #Marketing", imageKeys: [] });
  });

  // Conversation
  const conv = await quiet(() => startConversation(ana, bruno.id));
  await sendMessage(ana, conv, "Hi Bruno! Thanks for applying. Do you have time for a short call on Thursday?");
  await sendMessage(bruno, conv, "Hi Ana! Thursday works great, any time after 5pm.");

  void admin;
  console.log("Seeded demo data. Sign in as ana@demo.collabhub.local (or bruno, carla, diogo, elena, farid, grace; morgan is an admin) with password:", PASSWORD);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
