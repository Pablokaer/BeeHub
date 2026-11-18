import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { getTagBySlug } from "@/server/tags";
import { listPostsFor } from "@/server/posts";
import { searchOpportunities, searchPeople, searchProjects } from "@/server/search";
import { PageHeader, Panel, SectionTitle, EmptyState } from "@/components/ui/misc";
import { PostList } from "@/components/post-card";
import { OpportunityRow } from "@/components/opportunity-card";
import { PersonCard, ProjectCard } from "@/components/entity-cards";

export async function generateMetadata({ params }: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `#${slug}` };
}

/** Everything connected by one tag: people with the skill, projects using it, opportunities asking for it and posts. */
export default async function TagPage({ params }: PageProps<"/tags/[slug]">) {
  const { slug } = await params;
  const viewer = await getViewer();
  const tag = await getTagBySlug(decodeURIComponent(slug));
  if (!tag) notFound();
  const [posts, projects, people, opps] = await Promise.all([
    listPostsFor(viewer, { tagSlug: tag.slug }, { take: 10 }),
    searchProjects(viewer, { tags: [tag.slug] }),
    searchPeople(viewer, { skills: [tag.slug] }),
    searchOpportunities(viewer, { tags: [tag.slug] }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Tag" title={tag.name} description={`Used ${tag.usageCount} times across people, projects, opportunities and posts.`} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {projects.items.length > 0 && (
            <section>
              <SectionTitle action={<Link href={`/discover?type=projects&tech=${tag.slug}`} className="link text-[13px]">All {projects.total}</Link>}>Projects</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                {projects.items.slice(0, 4).map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionTitle>Posts</SectionTitle>
            {posts.items.length === 0 ? <EmptyState title={`No posts with #${tag.slug} yet`} /> : <PostList posts={posts.items} signedIn={!!viewer} />}
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <Panel className="p-0">
            <div className="px-4 pt-4">
              <SectionTitle action={<Link href={`/opportunities?skills=${tag.slug}`} className="link text-[13px]">All {opps.total}</Link>}>Opportunities</SectionTitle>
            </div>
            {opps.items.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">None open right now.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {opps.items.slice(0, 5).map((o) => (
                  <li key={o.id}>
                    <OpportunityRow opportunity={o} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <SectionTitle action={<Link href={`/discover?type=people&skills=${tag.slug}`} className="link text-[13px]">All {people.total}</Link>}>People</SectionTitle>
            {people.items.length === 0 ? (
              <p className="text-sm text-muted">No one lists this skill yet.</p>
            ) : (
              people.items.slice(0, 5).map((u) => <PersonCard key={u.id} user={u} compact />)
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
