import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Globe, MapPin, Plus, Settings } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { getOrganizationPage } from "@/server/organizations";
import { listPostsFor } from "@/server/posts";
import { hasRank, listPublishIdentities } from "@/server/authz";
import type { Viewer } from "@/server/auth/types";
import { memberRoleLabels, orgSizeLabels, orgTypeLabels, projectStageLabels } from "@/lib/constants";
import { mediaUrl } from "@/lib/media";
import { safeUrl } from "@/lib/text";
import { Avatar, EntityLogo } from "@/components/ui/avatar";
import { Badge, EmptyState, ListSkeleton, Panel, SectionTitle, TagList } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { OpportunityCard } from "@/components/opportunity-card";
import { RichText } from "@/components/rich-text";
import { PostList } from "@/components/post-card";
import { Composer } from "@/components/composer";
import { FollowButton } from "@/components/follow-button";
import { PartnershipRequest } from "@/components/partnership-request";
import { PartnerList } from "@/components/partner-list";
import { ReportButton } from "@/components/report-dialog";

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function OrgPage({ params }: PageProps<"/o/[slug]">) {
  const { slug } = await params;
  const viewer = await getViewer();
  const data = await getOrganizationPage(viewer, decodeURIComponent(slug));
  if (!data) notFound();
  const { org, viewerRole, projects, opportunities, followers, followStatus, partners } = data;
  const canEdit = hasRank(viewerRole, "EDITOR");
  const ids = viewer && !viewerRole ? await listPublishIdentities(viewer.id) : { orgs: [], projects: [] };
  const partnerIdentities = [...ids.orgs.filter((o) => o.id !== org.id).map((o) => ({ value: `org:${o.id}`, label: o.name })), ...ids.projects.map((p) => ({ value: `project:${p.id}`, label: p.name }))];
  const cover = mediaUrl(org.coverKey);
  const website = safeUrl(org.website);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel overflow-hidden" aria-labelledby="org-name">
          <div className="h-28 bg-gradient-to-r from-sunken to-accent-soft sm:h-36" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
          <div className="px-5 pb-5">
            <EntityLogo name={org.name} imageKey={org.logoKey} kind="org" size="xl" className="-mt-10 border-4 border-surface bg-surface" />
            <p className="eyebrow mt-2">{orgTypeLabels[org.type]}{org.industry ? ` · ${org.industry}` : ""}</p>
            <h1 id="org-name" className="text-2xl font-semibold">
              {org.name}
            </h1>
            {org.tagline && <p className="mt-1 text-[15px] text-ink-2">{org.tagline}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {org.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {org.location}
                </span>
              )}
              {org.size && <span>{orgSizeLabels[org.size]} people</span>}
              <span>{followers} followers</span>
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                  <Globe className="size-3.5" aria-hidden /> {new URL(website).hostname}
                </a>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canEdit && (
                <ButtonLink href={`/orgs/${org.slug}/manage`} variant="secondary" size="sm">
                  <Settings className="size-4" aria-hidden /> Manage
                </ButtonLink>
              )}
              {viewer && !viewerRole && <FollowButton kind="org" id={org.id} status={followStatus} name={org.name} />}
              {org.status === "ARCHIVED" && <Badge tone="warn">Archived</Badge>}
              <span className="ml-auto">{viewer && !viewerRole && <ReportButton targetType="ORGANIZATION" targetId={org.id} />}</span>
            </div>
            {viewer && !viewerRole && <PartnershipRequest targetType="org" targetId={org.id} targetName={org.name} identities={partnerIdentities} />}
          </div>
        </section>

        <Panel>
          <SectionTitle action={canEdit && <ButtonLink href={`/opportunities/new?owner=org:${org.id}`} size="sm" variant="secondary"><Plus className="size-4" aria-hidden /> Publish</ButtonLink>}>Open opportunities</SectionTitle>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted">No open opportunities right now.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {opportunities.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          )}
        </Panel>

        {org.description && (
          <Panel>
            <SectionTitle>About</SectionTitle>
            <RichText text={org.description} className="text-sm leading-relaxed text-ink-2" />
            {org.tags.length > 0 && <TagList tags={org.tags.map((t) => t.tag)} max={20} className="mt-3" />}
          </Panel>
        )}

        <Panel>
          <SectionTitle action={canEdit && <ButtonLink href={`/projects/new?org=${org.id}`} size="sm" variant="secondary"><Plus className="size-4" aria-hidden /> New project</ButtonLink>}>Projects</SectionTitle>
          {projects.length === 0 ? (
            <p className="text-sm text-muted">No projects yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.slug}`} className="flex gap-3 rounded-md border border-line p-3 hover:border-line-strong">
                    <EntityLogo name={p.name} imageKey={p.logoKey} kind="project" size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{projectStageLabels[p.stage]}{p.visibility === "PRIVATE" ? " · Private" : ""}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{p.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <section aria-labelledby="org-updates" className="flex flex-col gap-3">
          <h2 id="org-updates" className="text-[15px] font-semibold">
            Updates
          </h2>
          {canEdit && viewer?.emailVerified && (
            <Composer viewerName={viewer.displayName} viewerAvatar={viewer.avatarKey} viewerArt={viewer.avatarArt} identities={[{ value: `org:${org.id}`, label: org.name }, { value: "user", label: viewer.displayName }]} defaultActingAs={`org:${org.id}`} placeholder={`Post as ${org.name}…`} />
          )}
          <Suspense fallback={<ListSkeleton rows={2} />}>
            <OrgPosts viewer={viewer} organizationId={org.id} />
          </Suspense>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Panel>
          <SectionTitle>People</SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {org.members.slice(0, 12).map((m) => {
              const name = m.user.profile?.displayName ?? m.user.username;
              return (
                <li key={m.user.id} className="flex items-center gap-2.5">
                  <Avatar name={name} imageKey={m.user.profile?.avatarKey} art={m.user.profile?.avatarArt} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/u/${m.user.username}`} className="block truncate text-sm font-medium hover:underline">
                      {name}
                    </Link>
                    <p className="truncate text-xs text-muted">{m.title ? `${m.title} · ` : ""}{memberRoleLabels[m.role]}</p>
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
      </aside>
    </div>
  );
}

async function OrgPosts({ viewer, organizationId }: { viewer: Viewer | null; organizationId: string }) {
  const { items } = await listPostsFor(viewer, { organizationId }, { take: 10 });
  if (items.length === 0) return <EmptyState title="No updates yet" />;
  return <PostList posts={items} signedIn={!!viewer} />;
}
