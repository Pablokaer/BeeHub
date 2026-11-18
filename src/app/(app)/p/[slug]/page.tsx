import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Code2, Globe, Lock, Plus, Settings } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { getProjectPage } from "@/server/projects";
import { listPostsFor } from "@/server/posts";
import { listPublishIdentities, hasRank } from "@/server/authz";
import type { Viewer } from "@/server/auth/types";
import { memberRoleLabels, projectCategoryLabels, projectStageLabels } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { safeUrl } from "@/lib/text";
import { Avatar, EntityLogo } from "@/components/ui/avatar";
import { Badge, EmptyState, KeyValue, ListSkeleton, Panel, SectionTitle, TagList } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { OpportunityCard } from "@/components/opportunity-card";
import { RichText } from "@/components/rich-text";
import { PostList } from "@/components/post-card";
import { Composer } from "@/components/composer";
import { FollowButton } from "@/components/follow-button";
import { PartnershipRequest } from "@/components/partnership-request";
import { PartnerList } from "@/components/partner-list";
import { ReportButton } from "@/components/report-dialog";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function ProjectPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const viewer = await getViewer();
  const data = await getProjectPage(viewer, decodeURIComponent(slug));
  if (!data) notFound();
  const { project: p, viewerRole, opportunities, partners, followers, followStatus } = data;
  const canEdit = hasRank(viewerRole, "EDITOR");
  const identities = viewer ? await listPublishIdentities(viewer.id) : { orgs: [], projects: [] };
  const partnerIdentities = [
    ...identities.projects.filter((x) => x.id !== p.id).map((x) => ({ value: `project:${x.id}`, label: x.name })),
    ...identities.orgs.map((o) => ({ value: `org:${o.id}`, label: o.name })),
  ];
  const tech = p.tags.filter((t) => t.kind === "TECH").map((t) => t.tag);
  const topics = p.tags.filter((t) => t.kind === "TOPIC").map((t) => t.tag);
  const cover = mediaUrl(p.coverKey);
  const website = safeUrl(p.websiteUrl);
  const repo = safeUrl(p.repoUrl);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel overflow-hidden" aria-labelledby="project-name">
          {cover && <div className="h-32 bg-sunken sm:h-40" style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
          <div className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <EntityLogo name={p.name} imageKey={p.logoKey} kind="project" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Project · {projectCategoryLabels[p.category]}</p>
                <h1 id="project-name" className="flex items-center gap-2 text-2xl font-semibold">
                  {p.name}
                  {p.visibility === "PRIVATE" && <Lock className="size-4 text-muted" aria-label="Private project" />}
                </h1>
                <p className="mt-1 text-[15px] text-ink-2">{p.summary}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Badge tone="accent">{projectStageLabels[p.stage]}</Badge>
                  {p.status === "ARCHIVED" && <Badge tone="warn">Archived</Badge>}
                  {p.isOpenSource && <Badge>Open source</Badge>}
                  {p.acceptsBeginners && <Badge>Beginner-friendly</Badge>}
                  {opportunities.filter((o) => o.status === "OPEN").length > 0 && <Badge tone="signal">Looking for collaborators</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canEdit && (
                <ButtonLink href={`/projects/${p.slug}/manage`} variant="secondary" size="sm">
                  <Settings className="size-4" aria-hidden /> Manage
                </ButtonLink>
              )}
              {viewer && !viewerRole && p.visibility === "PUBLIC" && <FollowButton kind="project" id={p.id} status={followStatus} name={p.name} />}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-sunken">
                  <Globe className="size-4" aria-hidden /> Website
                </a>
              )}
              {repo && (
                <a href={repo} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-sunken">
                  <Code2 className="size-4" aria-hidden /> Repository
                </a>
              )}
              <span className="ml-auto">{viewer && !viewerRole && <ReportButton targetType="PROJECT" targetId={p.id} />}</span>
            </div>
            {viewer && !viewerRole && p.visibility === "PUBLIC" && <PartnershipRequest targetType="project" targetId={p.id} targetName={p.name} identities={partnerIdentities} />}
          </div>
        </section>

        <Panel aria-labelledby="looking-for">
          <SectionTitle
            id="looking-for"
            action={
              canEdit && (
                <ButtonLink href={`/opportunities/new?owner=project:${p.id}`} size="sm" variant="secondary">
                  <Plus className="size-4" aria-hidden /> Publish opportunity
                </ButtonLink>
              )
            }
          >
            Looking for
          </SectionTitle>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted">{canEdit ? "Publish what your project needs: roles, partners, testers, mentors…" : "No open opportunities right now."}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {opportunities.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} showStatus={canEdit} />
              ))}
            </div>
          )}
        </Panel>

        {(p.description || p.goals || p.needs) && (
          <Panel>
            {p.description && (
              <>
                <SectionTitle>About</SectionTitle>
                <RichText text={p.description} className="text-sm leading-relaxed text-ink-2" />
              </>
            )}
            {p.goals && (
              <>
                <h3 className="mb-1.5 mt-4 text-sm font-semibold">Goals</h3>
                <RichText text={p.goals} className="text-sm leading-relaxed text-ink-2" />
              </>
            )}
            {p.needs && (
              <>
                <h3 className="mb-1.5 mt-4 text-sm font-semibold">Current needs</h3>
                <RichText text={p.needs} className="text-sm leading-relaxed text-ink-2" />
              </>
            )}
          </Panel>
        )}

        {p.images.length > 0 && (
          <Panel>
            <SectionTitle>Gallery</SectionTitle>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.images.map((img) => (
                <li key={img.id}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(img.key)!} alt={img.caption ?? `${p.name} screenshot`} loading="lazy" className="aspect-video w-full rounded-md border border-line object-cover" />
                    {img.caption && <figcaption className="mt-1 text-xs text-muted">{img.caption}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <section aria-labelledby="updates" className="flex flex-col gap-3">
          <h2 id="updates" className="text-[15px] font-semibold">
            Updates
          </h2>
          {canEdit && viewer?.emailVerified && (
            <Composer
              viewerName={viewer.displayName}
              viewerAvatar={viewer.avatarKey} viewerArt={viewer.avatarArt}
              identities={[{ value: `project:${p.id}`, label: p.name }, { value: "user", label: viewer.displayName }]}
              defaultActingAs={`project:${p.id}`}
              placeholder={`Post an update as ${p.name}…`}
            />
          )}
          <Suspense fallback={<ListSkeleton rows={2} />}>
            <ProjectPosts viewer={viewer} projectId={p.id} />
          </Suspense>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Panel>
          <SectionTitle>Team</SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {p.members.map((m) => {
              const name = m.user.profile?.displayName ?? m.user.username;
              return (
                <li key={m.user.id} className="flex items-center gap-2.5">
                  <Avatar name={name} imageKey={m.user.profile?.avatarKey} art={m.user.profile?.avatarArt} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/u/${m.user.username}`} className="block truncate text-sm font-medium hover:underline">
                      {name}
                    </Link>
                    <p className="truncate text-xs text-muted">{m.title ? `${m.title} · ${memberRoleLabels[m.role]}` : memberRoleLabels[m.role]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          <SectionTitle>Partners</SectionTitle>
          <PartnerList partners={partners} />
        </Panel>
        {(tech.length > 0 || topics.length > 0) && (
          <Panel>
            {tech.length > 0 && (
              <>
                <SectionTitle>Technologies</SectionTitle>
                <TagList tags={tech} max={20} />
              </>
            )}
            {topics.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold">Topics</h3>
                <TagList tags={topics} max={15} />
              </>
            )}
          </Panel>
        )}
        <Panel>
          <KeyValue
            items={[
              { label: "Organization", value: p.organization && p.organization.status === "ACTIVE" ? <Link href={`/o/${p.organization.slug}`} className="link">{p.organization.name}</Link> : null },
              { label: "Created by", value: p.createdBy && p.createdBy.status === "ACTIVE" ? <Link href={`/u/${p.createdBy.username}`} className="link">{p.createdBy.profile?.displayName}</Link> : null },
              { label: "Created", value: formatDate(p.createdAt) },
              { label: "Followers", value: followers },
            ]}
          />
        </Panel>
      </aside>
    </div>
  );
}

async function ProjectPosts({ viewer, projectId }: { viewer: Viewer | null; projectId: string }) {
  const { items } = await listPostsFor(viewer, { projectId }, { take: 10 });
  if (items.length === 0) return <EmptyState title="No updates yet">Project updates and announcements will show up here.</EmptyState>;
  return <PostList posts={items} signedIn={!!viewer} />;
}
