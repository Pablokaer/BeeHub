import type { Metadata } from "next";
import { Plus, Search, Briefcase } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { searchOpportunities } from "@/server/search";
import { collaborationLabels, enumKeys, experienceLabels, opportunityCategoryLabels, workModeLabels } from "@/lib/constants";
import { bool, enumList, list, page, str, type SP } from "@/lib/search-params";
import { OpportunityCard } from "@/components/opportunity-card";
import { FilterCheck, FilterGroup, FilterPanel, FilterRadio, FilterText } from "@/components/filters";
import { PositionPicker } from "@/components/position-picker";
import { isPositionId } from "@/lib/positions";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const sp = (await searchParams) as SP;
  const viewer = await getViewer();
  const f = {
    q: str(sp, "q"),
    position: list(sp, "position").filter(isPositionId),
    skills: list(sp, "skills"),
    category: enumList(sp, "category", opportunityCategoryLabels),
    collaborationType: enumList(sp, "type", collaborationLabels),
    workMode: enumList(sp, "mode", workModeLabels),
    experience: enumList(sp, "level", experienceLabels),
    paid: bool(sp, "paid"),
    owner: (["project", "org", "person"] as const).find((o) => o === str(sp, "owner")),
    location: str(sp, "location"),
    sort: (["recent", "deadline", "match"] as const).find((s) => s === str(sp, "sort")) ?? "recent",
    page: page(sp),
  };
  const results = await searchOpportunities(viewer, { ...f, sort: f.sort === "match" && !viewer ? "recent" : f.sort });

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description="Roles, partnerships, freelance gigs, volunteering, mentorship and more — published by projects, organizations and people."
        actions={
          viewer && (
            <ButtonLink href="/opportunities/new" size="sm">
              <Plus className="size-4" aria-hidden /> Publish opportunity
            </ButtonLink>
          )
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside>
          <FilterPanel action="/opportunities" hidden={{ q: f.q, sort: f.sort !== "recent" ? f.sort : undefined }}>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-2" id="filter-position-label">
                Position
              </p>
              <PositionPicker name="position" multiple defaultValue={f.position} label="Filter by position" placeholder="e.g. designer, SEO, AI…" />
            </div>
            <FilterText name="skills" label="Skills" defaultValue={f.skills.join(", ")} placeholder="react, marketing" />
            <FilterGroup legend="Collaboration type">
              {enumKeys(collaborationLabels).map((v) => (
                <FilterCheck key={v} name="type" value={v} label={collaborationLabels[v]} checked={f.collaborationType.includes(v)} />
              ))}
            </FilterGroup>
            <FilterGroup legend="Compensation">
              <FilterRadio name="paid" value="" label="Any" checked={f.paid === undefined} />
              <FilterRadio name="paid" value="1" label="Paid" checked={f.paid === true} />
              <FilterRadio name="paid" value="0" label="Unpaid / volunteer" checked={f.paid === false} />
            </FilterGroup>
            <FilterGroup legend="Work mode">
              {enumKeys(workModeLabels).map((v) => (
                <FilterCheck key={v} name="mode" value={v} label={workModeLabels[v]} checked={f.workMode.includes(v)} />
              ))}
            </FilterGroup>
            <FilterGroup legend="Experience">
              {enumKeys(experienceLabels).map((v) => (
                <FilterCheck key={v} name="level" value={v} label={experienceLabels[v]} checked={f.experience.includes(v)} />
              ))}
            </FilterGroup>
            <FilterGroup legend="Category">
              {enumKeys(opportunityCategoryLabels).map((v) => (
                <FilterCheck key={v} name="category" value={v} label={opportunityCategoryLabels[v]} checked={f.category.includes(v)} />
              ))}
            </FilterGroup>
            <FilterGroup legend="Published by">
              <FilterRadio name="owner" value="" label="Anyone" checked={!f.owner} />
              <FilterRadio name="owner" value="project" label="Projects" checked={f.owner === "project"} />
              <FilterRadio name="owner" value="org" label="Organizations" checked={f.owner === "org"} />
              <FilterRadio name="owner" value="person" label="Individuals" checked={f.owner === "person"} />
            </FilterGroup>
            <FilterText name="location" label="Location" defaultValue={f.location} placeholder="City or region" />
          </FilterPanel>
        </aside>
        <section aria-label="Results" className="min-w-0">
          <form action="/opportunities" className="mb-3 flex flex-wrap items-center gap-2" role="search">
            {Object.entries(sp).map(([k, v]) =>
              k === "q" || k === "sort" || k === "page" ? null : (Array.isArray(v) ? v : [v]).map((x, i) => (x ? <input key={`${k}-${i}`} type="hidden" name={k} value={x} /> : null)),
            )}
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="opp-q" className="sr-only">
                Search opportunities
              </label>
              <input id="opp-q" name="q" type="search" defaultValue={f.q} placeholder="e.g. frontend developer for AI project" className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <label htmlFor="opp-sort" className="sr-only">
              Sort
            </label>
            <select id="opp-sort" name="sort" defaultValue={f.sort} className="h-10 rounded-lg border border-line-strong bg-surface px-2 text-sm">
              <option value="recent">Most recent</option>
              <option value="deadline">Deadline soonest</option>
              {viewer && <option value="match">Best match for me</option>}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm hover:bg-sunken">
              Search
            </button>
          </form>
          <p className="mb-3 text-[13px] text-muted" aria-live="polite">
            {results.total} {results.total === 1 ? "opportunity" : "opportunities"}
          </p>
          {results.items.length === 0 ? (
            <EmptyState icon={<Briefcase />} title="No opportunities match these filters" action={<ButtonLink href="/opportunities" variant="secondary" size="sm">Clear filters</ButtonLink>}>
              Try fewer filters or different skills. New opportunities are published every day.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {results.items.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} match={o.match} />
              ))}
            </div>
          )}
          <Pagination page={results.page} pageCount={results.pageCount} baseHref="/opportunities" params={sp} />
        </section>
      </div>
    </div>
  );
}
