import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createProject, getProjectPage, updateProject, suggestComplementaryProjects } from "@/server/projects";
import { createOrganization } from "@/server/organizations";
import { createOpportunity, getOpportunity, setOpportunityStatus } from "@/server/opportunities";
import { applyToOpportunity, listReceivedApplications, listSentApplications, updateApplicationStatus, withdrawApplication } from "@/server/applications";
import { searchOpportunities, searchPeople, searchProjects } from "@/server/search";
import { recommendCandidates, recommendOpportunities } from "@/server/matching";
import { inviteToProject, respondToInvitation } from "@/server/invitations";
import { requestPartnership, respondToPartnership, partnershipsFor } from "@/server/partnerships";
import { canMessage, startConversation, sendMessage, listConversations } from "@/server/messaging";
import { createUser, resetDb, setSkills, viewerOf } from "../helpers";

const projectInput = (slug: string, extra: Record<string, unknown> = {}) => ({
  name: `Project ${slug}`,
  slug,
  summary: "An AI assistant that helps students study better.",
  category: "AI_ML" as const,
  stage: "PROTOTYPE" as const,
  visibility: "PUBLIC" as const,
  isOpenSource: true,
  acceptsBeginners: true,
  tech: ["Python", "PyTorch"],
  topics: ["Artificial Intelligence", "Education"],
  ...extra,
});

const oppInput = (owner: string, extra: Record<string, unknown> = {}) => ({
  owner,
  position: "frontend-developer",
  title: "Frontend developer for our study assistant",
  description: "Help us build the web interface in React and TypeScript. Beginners welcome.",
  category: "ENGINEERING" as const,
  collaborationType: "VOLUNTEER" as const,
  workMode: "REMOTE" as const,
  compensationType: "NONE" as const,
  skills: ["React", "TypeScript", "Frontend"],
  topics: ["Artificial Intelligence"],
  publish: true,
  ...extra,
});

describe("Scenario A/B/E: projects, opportunities, discovery and applications", () => {
  beforeEach(resetDb);

  it("runs the full vertical flow end to end", async () => {
    const dev = await createUser({ name: "Dev Owner", username: "devowner" });
    const student = await createUser({ name: "Stu Dent", username: "student" });
    await setSkills(student, ["React", "TypeScript", "Frontend"], { availability: ["OPEN_TO_VOLUNTEER", "LOOKING_FOR_PROJECTS"], preferredCollabs: ["VOLUNTEER"], experienceLevel: "BEGINNER" });

    const project = await createProject(dev, projectInput("study-ai"));
    const opp = await createOpportunity(dev, oppInput(`project:${project.id}`));
    expect(opp.status).toBe("OPEN");
    // Publishing announces the opportunity in the feed and notifies strong matches.
    expect(await db.post.count({ where: { opportunityId: opp.id, type: "OPPORTUNITY" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: student.id, type: "OPPORTUNITY_MATCH" } })).toBe(1);

    // Scenario E: AI projects in prototype stage that need frontend developers.
    const projects = await searchProjects(viewerOf(student), { q: "assistant", category: ["AI_ML"], stage: ["PROTOTYPE"], lookingFor: ["frontend"] });
    expect(projects.items.map((p) => p.slug)).toEqual(["study-ai"]);
    expect((await searchProjects(null, { lookingFor: ["marketing"] })).total).toBe(0);
    expect((await searchProjects(null, { beginnerFriendly: true, openSource: true })).total).toBe(1);

    const opps = await searchOpportunities(viewerOf(student), { skills: ["reactjs"], collaborationType: ["VOLUNTEER"], sort: "match" });
    expect(opps.items[0].id).toBe(opp.id);
    expect(opps.items[0].match?.score).toBeGreaterThan(60);

    const recs = await recommendOpportunities(student.id);
    expect(recs[0]?.opportunity.id).toBe(opp.id);
    expect(recs[0].match.reasons[0].text).toMatch(/requested skills/);
    const candidates = await recommendCandidates(opp.id, [dev.id]);
    expect(candidates.map((c) => c.user.username)).toContain("student");

    // Scenario A: apply, owner reviews, accepts → student joins the team.
    const app = await applyToOpportunity(student, { opportunityId: opp.id, message: "I'd love to help build the React interface!" });
    await expect(applyToOpportunity(student, { opportunityId: opp.id, message: "Applying a second time to check duplicates" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(applyToOpportunity(dev, { opportunityId: opp.id, message: "Owner should not be able to apply here" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.notification.count({ where: { userId: dev.id, type: "APPLICATION_RECEIVED" } })).toBe(1);

    const received = await listReceivedApplications(dev);
    expect(received).toHaveLength(1);
    expect(received[0].applicant.username).toBe("student");
    await expect(updateApplicationStatus(student, app.id, "ACCEPTED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateApplicationStatus(dev, app.id, "IN_REVIEW");
    await updateApplicationStatus(dev, app.id, "ACCEPTED", { markFilled: true });
    await expect(updateApplicationStatus(dev, app.id, "RECEIVED")).rejects.toMatchObject({ code: "VALIDATION" });

    const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId: student.id } } });
    expect(member).toMatchObject({ role: "MEMBER", opportunityId: opp.id });
    const sent = await listSentApplications(student);
    expect(sent[0].status).toBe("ACCEPTED");
    expect(sent[0].events.map((e) => e.toStatus)).toEqual(["RECEIVED", "IN_REVIEW", "ACCEPTED"]);
    expect(await db.notification.count({ where: { userId: student.id, type: "APPLICATION_STATUS" } })).toBe(2);
    expect((await db.opportunity.findUnique({ where: { id: opp.id } }))?.status).toBe("FILLED");
  });

  it("enforces closed opportunities, withdrawals and re-applications", async () => {
    const owner = await createUser();
    const a = await createUser();
    const opp = await createOpportunity(owner, oppInput("user"));
    const app = await applyToOpportunity(a, { opportunityId: opp.id, message: "Here is my application message." });
    await withdrawApplication(a, app.id);
    await applyToOpportunity(a, { opportunityId: opp.id, message: "Re-applying after withdrawing it." });
    await setOpportunityStatus(owner, opp.id, "CLOSED");
    const b = await createUser();
    await expect(applyToOpportunity(b, { opportunityId: opp.id, message: "Too late for this one, sadly." })).rejects.toThrow(/no longer accepting/);
    // Archiving keeps history.
    await setOpportunityStatus(owner, opp.id, "ARCHIVED");
    expect(await db.application.count({ where: { opportunityId: opp.id } })).toBe(1);
    expect((await searchOpportunities(null, {})).total).toBe(0);
  });

  it("keeps private projects and their data out of public discovery", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const p = await createProject(owner, projectInput("secret-lab", { visibility: "PRIVATE" }));
    await expect(createOpportunity(owner, oppInput(`project:${p.id}`))).rejects.toThrow(/public/);
    await createOpportunity(owner, oppInput(`project:${p.id}`, { publish: false }));
    expect((await searchProjects(viewerOf(outsider), { q: "secret" })).total).toBe(0);
    expect(await getProjectPage(viewerOf(outsider), "secret-lab")).toBeNull();
    expect(await getProjectPage(viewerOf(owner), "secret-lab")).not.toBeNull();
    expect((await searchOpportunities(null, {})).total).toBe(0);
  });

  it("only lets authorized members edit and manage", async () => {
    const owner = await createUser();
    const editor = await createUser({ username: "eddie" });
    const stranger = await createUser();
    const p = await createProject(owner, projectInput("team-proj"));
    await expect(updateProject(stranger, p.id, projectInput("team-proj", { name: "Hacked" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(inviteToProject(stranger, p.id, { username: "eddie", role: "MEMBER" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const inv = await inviteToProject(owner, p.id, { username: "eddie", role: "EDITOR", title: "Designer" });
    await expect(inviteToProject(owner, p.id, { username: "eddie", role: "EDITOR" })).rejects.toMatchObject({ code: "CONFLICT" });
    await respondToInvitation(editor, inv.id, true);
    await updateProject(editor, p.id, projectInput("team-proj", { name: "Renamed by editor" }));
    // Editors can't change the handle (owner only) or invite.
    await expect(updateProject(editor, p.id, projectInput("new-handle"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(inviteToProject(editor, p.id, { username: stranger.username, role: "MEMBER" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const page = await getProjectPage(null, "team-proj");
    expect(page?.project.name).toBe("Renamed by editor");
    expect(page?.project.members.map((m) => m.user.username)).toContain("eddie");
  });
});

describe("Scenario C: organizations looking for partners", () => {
  beforeEach(resetDb);

  it("lets one organization find another's partnership opportunity, apply and start a conversation", async () => {
    const alice = await createUser({ username: "alice" });
    const bruno = await createUser({ username: "bruno" });
    await db.profile.update({ where: { userId: alice.id }, data: { messagePermission: "CONNECTIONS" } });
    const acme = await createOrganization(alice, { name: "Acme Labs", slug: "acme-labs", type: "STARTUP", tags: ["Fintech"], description: "Payments startup" });
    const beta = await createOrganization(bruno, { name: "Beta Retail", slug: "beta-retail", type: "COMPANY", tags: ["E-commerce"] });
    const opp = await createOpportunity(alice, oppInput(`org:${acme.id}`, {
      title: "Commercial partner for payments rollout",
      description: "Looking for retail companies to pilot our payment product together.",
      category: "PARTNERSHIP", collaborationType: "BUSINESS_PARTNERSHIP", skills: ["Business Development"], topics: ["Fintech"],
    }));

    const found = await searchOpportunities(viewerOf(bruno), { collaborationType: ["BUSINESS_PARTNERSHIP"], owner: "org" });
    expect(found.items.map((o) => o.id)).toEqual([opp.id]);

    expect(await canMessage(bruno.id, alice.id)).toMatchObject({ allowed: false });
    await expect(applyToOpportunity(bruno, { opportunityId: opp.id, message: "Beta Retail would like to pilot this.", organizationId: acme.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await applyToOpportunity(bruno, { opportunityId: opp.id, message: "Beta Retail would like to pilot this.", organizationId: beta.id });
    // An application opens the conversation channel even with "connections only".
    expect(await canMessage(bruno.id, alice.id)).toMatchObject({ allowed: true });
    const convId = await startConversation(bruno, alice.id);
    expect(await startConversation(bruno, alice.id)).toBe(convId);
    await sendMessage(bruno, convId, "Hi Alice, shall we schedule a call?");
    const inbox = await listConversations(alice);
    expect(inbox[0]).toMatchObject({ id: convId, unread: true });
    expect(inbox[0].other?.username).toBe("bruno");
  });
});

describe("Scenario G: project partnerships", () => {
  beforeEach(resetDb);

  it("establishes a partnership visible on both projects and prevents duplicates", async () => {
    const a = await createUser();
    const b = await createUser();
    const ai = await createProject(a, projectInput("ai-core", { tech: ["Python"] }));
    const web = await createProject(b, projectInput("web-ui", { category: "WEB", tech: ["React", "TypeScript"], topics: ["Frontend"] }));
    await setSkills(b, ["React"]);
    await createOpportunity(a, oppInput(`project:${ai.id}`, { skills: ["React"] }));
    const suggestions = await suggestComplementaryProjects(ai.id);
    expect(suggestions[0]?.project.slug).toBe("web-ui");
    expect(suggestions[0].covers).toContain("React");

    const stranger = await createUser();
    await expect(requestPartnership(stranger, { projectId: ai.id }, { projectId: web.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const req = await requestPartnership(a, { projectId: ai.id }, { projectId: web.id }, "Let's combine AI with your UI");
    await expect(requestPartnership(a, { projectId: ai.id }, { projectId: web.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(respondToPartnership(a, req.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await respondToPartnership(b, req.id, true);
    const fromAi = await partnershipsFor({ projectId: ai.id }, "ACTIVE");
    const fromWeb = await partnershipsFor({ projectId: web.id }, "ACTIVE");
    expect(fromAi.map((p) => p.other.slug)).toEqual(["web-ui"]);
    expect(fromWeb.map((p) => p.other.slug)).toEqual(["ai-core"]);
    expect((await getProjectPage(null, "web-ui"))?.partners).toHaveLength(1);
    // A mirrored request is not a second row.
    await expect(requestPartnership(b, { projectId: web.id }, { projectId: ai.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.partnership.count()).toBe(1);
  });
});

describe("people discovery privacy", () => {
  beforeEach(resetDb);

  it("respects searchable, visibility and hidden location", async () => {
    const viewer = await createUser();
    const a = await createUser({ name: "Rita React" });
    const b = await createUser({ name: "Hidden Hugo" });
    await setSkills(a, ["React"], { location: "Lisbon", availability: ["OPEN_TO_PAID_WORK"] });
    await setSkills(b, ["React"], { location: "Lisbon" });
    await db.profile.update({ where: { userId: b.id }, data: { searchable: false } });
    await db.profile.update({ where: { userId: a.id }, data: { showLocation: false } });
    const all = await searchPeople(viewerOf(viewer), { skills: ["react"] });
    expect(all.items.map((u) => u.id)).toEqual([a.id]);
    // A hidden location can't be used to find someone.
    expect((await searchPeople(viewerOf(viewer), { location: "Lisbon" })).total).toBe(0);
    expect((await searchPeople(viewerOf(viewer), { availability: ["OPEN_TO_PAID_WORK"], skills: ["react"] })).total).toBe(1);
    const op = await getOpportunity(null, "missing");
    expect(op).toBeNull();
  });
});

describe("positions on opportunities", () => {
  beforeEach(resetDb);
  it("stores the position, defaults the title to it and filters by it", async () => {
    const owner = await createUser({ name: "Pat Publisher" });
    const viewer = await createUser();
    const fe = await createOpportunity(owner, oppInput("user", { title: undefined }));
    expect(fe.position).toBe("frontend-developer");
    expect(fe.title).toBe("Frontend developer");
    await createOpportunity(owner, oppInput("user", { position: "seo-specialist", title: "SEO for our launch", category: "MARKETING", skills: ["SEO"] }));
    await createOpportunity(owner, oppInput("user", { position: "ai-engineer", title: "Build our RAG pipeline", skills: ["Python"] }));

    const byPosition = await searchOpportunities(viewerOf(viewer), { position: ["seo-specialist", "ai-engineer"] });
    expect(byPosition.items.map((o) => o.position).sort()).toEqual(["ai-engineer", "seo-specialist"]);
    // Free text also finds positions through their aliases.
    const byAlias = await searchOpportunities(viewerOf(viewer), { q: "genai" });
    expect(byAlias.items.map((o) => o.position)).toEqual(["ai-engineer"]);
    // Unknown ids in the URL are ignored rather than matching nothing.
    expect((await searchOpportunities(viewerOf(viewer), { position: ["nope"] })).total).toBe(3);
  });

  it("rejects an unknown position in the service", async () => {
    const owner = await createUser();
    await expect(createOpportunity(owner, oppInput("user", { position: "chief-vibes-officer" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
