import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Search } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { quickSearch, searchOrganizations, searchPeople, searchPosts, searchProjects } from "@/server/search";
import { popularTags } from "@/server/tags";
import type { Viewer } from "@/server/auth/types";
import {
  availabilityLabels, collaborationLabels, enumKeys, experienceLabels, orgSizeLabels, orgTypeLabels, projectCategoryLabels, projectStageLabels,
} from "@/lib/constants";
import { bool, enumList, list, page, str, type SP } from "@/lib/search-params";
import { OrgCard, PersonCard, ProjectCard } from "@/components/entity-cards";
import { OpportunityCard } from "@/components/opportunity-card";
import { PostList } from "@/components/post-card";
import { FilterCheck, FilterGroup, FilterPanel, FilterText } from "@/components/filters";
import { EmptyState, PageHeader, Pagination, SectionTitle, Tabs, TagChip } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Discover" };

const TYPES = ["all", "people", "projects", "organizations", "posts"] as const;
type DiscoverType = (typeof TYPES)[number];

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = (await searchParams) as SP;
  const viewer = await getViewer();
  const type: DiscoverType = TYPES.find((t) => t === str(sp, "type")) ?? "all";
  const q = str(sp, "q");
  const tabHref = (t: DiscoverType) => {
    const p = new URLSearchParams();
    if (t !== "all") p.set("type", t);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/discover${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Discover" description="Find people, projects and organizations by name, skill, technology or topic." />
      <form action="/discover" role="search" className="mb-4 flex gap-2">
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        {Object.entries(sp).flatMap(([key, value]) =>
          key === "q" || key === "type" || key === "page" ? [] :
            (Array.isArray(value) ? value : [value]).map((item, index) =>
              item ? <input key={`${key}-${index}`} type="hidden" name={key} value={item} /> : null,
            ),
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="discover-q" className="sr-only">
            Search
          </label>
          <input id="discover-q" name="q" type="search" defaultValue={q} placeholder="Try “AI projects”, “react freelancer” or “fintech startup”" className="h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </div>
        <button type="submit" className="cm-gold h-11 px-5 text-sm">
          Search
        </button>
      </form>
      <Tabs
        label="Result type"
        items={TYPES.map((t) => ({ href: tabHref(t), label: t === "all" ? "Overview" : t[0].toUpperCase() + t.slice(1), active: type === t }))}
      />
      {type === "all" && <Overview viewer={viewer} q={q} tabHref={tabHref} />}
      {type === "people" && <People viewer={viewer} sp={sp} />}
      {type === "projects" && <Projects viewer={viewer} sp={sp} />}
      {type === "organizations" && <Organizations sp={sp} />}
      {type === "posts" && <Posts viewer={viewer} sp={sp} />}
    </div>
  );
}

async function Overview({ viewer, q, tabHref }: { viewer: Viewer | null; q?: string; tabHref: (t: DiscoverType) => string }) {
  if (!q) {
    const [projects, tags, orgs] = await Promise.all([searchProjects(viewer, { openOpportunities: true }), popularTags(24), searchOrganizations({})]);
    return (
      <div className="flex flex-col gap-8">
        {tags.length > 0 && (
          <section>
            <SectionTitle>Browse by tag</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <TagChip key={t.slug} slug={t.slug} name={t.name} />
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionTitle action={<Link href="/discover?type=projects&open=1" className="link text-[13px]">See all</Link>}>Projects looking for collaborators</SectionTitle>
          {projects.items.length === 0 ? (
            <EmptyState icon={<Compass />} title="No projects are recruiting yet" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.items.slice(0, 6).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>
        {orgs.items.length > 0 && (
          <section>
            <SectionTitle action={<Link href="/discover?type=organizations" className="link text-[13px]">See all</Link>}>Organizations</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {orgs.items.slice(0, 4).map((o) => (
                <OrgCard key={o.id} org={o} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }
  const r = await quickSearch(viewer, q);
  const total = r.totals ? Object.values(r.totals).reduce((a, b) => a + b, 0) : 0;
  if (total === 0) return <EmptyState icon={<Search />} title={`No results for “${q}”`}>Try a broader term, a skill like “React”, or a topic like “education”.</EmptyState>;
  return (
    <div className="flex flex-col gap-8">
      {r.opportunities.length > 0 && (
        <section>
          <SectionTitle action={<Link href={`/opportunities?q=${encodeURIComponent(q)}`} className="link text-[13px]">All {r.totals?.opportunities} opportunities</Link>}>Opportunities</SectionTitle>
          <div className="flex flex-col gap-3">
            {r.opportunities.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        </section>
      )}
      {r.projects.length > 0 && (
        <section>
          <SectionTitle action={<Link href={tabHref("projects")} className="link text-[13px]">All {r.totals?.projects} projects</Link>}>Projects</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {r.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
      {r.people.length > 0 && (
        <section>
          <SectionTitle action={<Link href={tabHref("people")} className="link text-[13px]">All {r.totals?.people} people</Link>}>People</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {r.people.map((u) => (
              <PersonCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      )}
      {r.organizations.length > 0 && (
        <section>
          <SectionTitle action={<Link href={tabHref("organizations")} className="link text-[13px]">All {r.totals?.organizations} organizations</Link>}>Organizations</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {r.organizations.map((o) => (
              <OrgCard key={o.id} org={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Layout({ filters, children, total, sp, base }: { filters: React.ReactNode; children: React.ReactNode; total: number; sp: SP; base: string; }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside>{filters}</aside>
      <section aria-label="Results" className="min-w-0">
        <p className="mb-3 text-[13px] text-muted" aria-live="polite">
          {total} result{total === 1 ? "" : "s"}
        </p>
        {children}
        <Pagination page={page(sp)} pageCount={Math.max(1, Math.ceil(total / 20))} baseHref={base} params={sp} />
      </section>
    </div>
  );
}

async function People({ viewer, sp }: { viewer: Viewer | null; sp: SP }) {
  const f = {
    q: str(sp, "q"),
    skills: list(sp, "skills"),
    interests: list(sp, "interests"),
    location: str(sp, "location"),
    availability: enumList(sp, "availability", availabilityLabels).filter((a) => a !== "UNAVAILABLE"),
    experience: enumList(sp, "level", experienceLabels),
    language: str(sp, "language"),
    page: page(sp),
  };
  const r = await searchPeople(viewer, f);
  return (
    <Layout
      total={r.total}
      sp={sp}
      base="/discover"
      filters={
        <FilterPanel action="/discover" hidden={{ type: "people", q: f.q }}>
          <FilterText name="skills" label="Skills" defaultValue={f.skills.join(", ")} placeholder="react, ui/ux" />
          <FilterText name="interests" label="Interests" defaultValue={f.interests.join(", ")} placeholder="ai, education" />
          <FilterGroup legend="Availability">
            {enumKeys(availabilityLabels)
              .filter((a) => a !== "UNAVAILABLE")
              .map((v) => (
                <FilterCheck key={v} name="availability" value={v} label={availabilityLabels[v]} checked={f.availability.includes(v)} />
              ))}
          </FilterGroup>
          <FilterGroup legend="Experience">
            {enumKeys(experienceLabels).map((v) => (
              <FilterCheck key={v} name="level" value={v} label={experienceLabels[v]} checked={f.experience.includes(v)} />
            ))}
          </FilterGroup>
          <FilterText name="location" label="Location" defaultValue={f.location} />
          <FilterText name="language" label="Language" defaultValue={f.language} placeholder="English" />
        </FilterPanel>
      }
    >
      {r.items.length === 0 ? (
        <EmptyState title="No people match these filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {r.items.map((u) => (
            <PersonCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </Layout>
  );
}

async function Projects({ viewer, sp }: { viewer: Viewer | null; sp: SP }) {
  const f = {
    q: str(sp, "q"),
    category: enumList(sp, "category", projectCategoryLabels),
    stage: enumList(sp, "stage", projectStageLabels),
    tech: list(sp, "tech"),
    lookingFor: list(sp, "lookingFor"),
    collaborationType: enumList(sp, "collab", collaborationLabels),
    openOpportunities: bool(sp, "open"),
    beginnerFriendly: bool(sp, "beginners"),
    openSource: bool(sp, "oss"),
    sort: (["recent", "new", "name"] as const).find((s) => s === str(sp, "sort")),
    page: page(sp),
  };
  const r = await searchProjects(viewer, f);
  return (
    <Layout
      total={r.total}
      sp={sp}
      base="/discover"
      filters={
        <FilterPanel action="/discover" hidden={{ type: "projects", q: f.q }}>
          <FilterText name="lookingFor" label="Looking for skills" defaultValue={f.lookingFor.join(", ")} placeholder="frontend, marketing" />
          <FilterGroup legend="Recruiting">
            <FilterCheck name="open" value="1" label="Has open opportunities" checked={!!f.openOpportunities} />
            <FilterCheck name="beginners" value="1" label="Beginner-friendly" checked={!!f.beginnerFriendly} />
            <FilterCheck name="oss" value="1" label="Open source" checked={!!f.openSource} />
          </FilterGroup>
          <FilterGroup legend="Stage">
            {enumKeys(projectStageLabels).map((v) => (
              <FilterCheck key={v} name="stage" value={v} label={projectStageLabels[v]} checked={f.stage.includes(v)} />
            ))}
          </FilterGroup>
          <FilterGroup legend="Category">
            {enumKeys(projectCategoryLabels).map((v) => (
              <FilterCheck key={v} name="category" value={v} label={projectCategoryLabels[v]} checked={f.category.includes(v)} />
            ))}
          </FilterGroup>
          <FilterText name="tech" label="Technologies" defaultValue={f.tech.join(", ")} placeholder="python, react" />
          <FilterGroup legend="Collaboration offered">
            {enumKeys(collaborationLabels).map((v) => (
              <FilterCheck key={v} name="collab" value={v} label={collaborationLabels[v]} checked={f.collaborationType.includes(v)} />
            ))}
          </FilterGroup>
        </FilterPanel>
      }
    >
      {r.items.length === 0 ? (
        <EmptyState title="No projects match these filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {r.items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </Layout>
  );
}

async function Organizations({ sp }: { sp: SP }) {
  const f = {
    q: str(sp, "q"),
    type: enumList(sp, "orgType", orgTypeLabels),
    size: enumList(sp, "size", orgSizeLabels),
    industry: str(sp, "industry"),
    location: str(sp, "location"),
    tags: list(sp, "tags"),
    page: page(sp),
  };
  const r = await searchOrganizations(f);
  return (
    <Layout
      total={r.total}
      sp={sp}
      base="/discover"
      filters={
        <FilterPanel action="/discover" hidden={{ type: "organizations", q: f.q }}>
          <FilterGroup legend="Type">
            {enumKeys(orgTypeLabels).map((v) => (
              <FilterCheck key={v} name="orgType" value={v} label={orgTypeLabels[v]} checked={f.type.includes(v)} />
            ))}
          </FilterGroup>
          <FilterGroup legend="Size">
            {enumKeys(orgSizeLabels).map((v) => (
              <FilterCheck key={v} name="size" value={v} label={orgSizeLabels[v]} checked={f.size.includes(v)} />
            ))}
          </FilterGroup>
          <FilterText name="industry" label="Sector" defaultValue={f.industry} />
          <FilterText name="tags" label="Specialization" defaultValue={f.tags.join(", ")} placeholder="fintech, design" />
          <FilterText name="location" label="Location" defaultValue={f.location} />
        </FilterPanel>
      }
    >
      {r.items.length === 0 ? (
        <EmptyState title="No organizations match these filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {r.items.map((o) => (
            <OrgCard key={o.id} org={o} />
          ))}
        </div>
      )}
    </Layout>
  );
}

async function Posts({ viewer, sp }: { viewer: Viewer | null; sp: SP }) {
  const r = await searchPosts(viewer, { q: str(sp, "q"), tag: str(sp, "tag"), page: page(sp) });
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-[13px] text-muted">{r.total} posts</p>
      {r.items.length === 0 ? <EmptyState title="No posts found" /> : <PostList posts={r.items} signedIn={!!viewer} />}
      <Pagination page={r.page} pageCount={r.pageCount} baseHref="/discover" params={sp} />
    </div>
  );
}
