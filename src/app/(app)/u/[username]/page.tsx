import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Building2, ExternalLink, Lock } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { getPublicProfile, profileCompleteness } from "@/server/profiles";
import { canMessage } from "@/server/messaging";
import { listPostsFor } from "@/server/posts";
import { availabilityLabels, collaborationLabels, experienceLabels, memberRoleLabels, projectCategoryLabels, projectStageLabels, workModeLabels } from "@/lib/constants";
import { formatDate, formatMonth } from "@/lib/format";
import { safeUrl } from "@/lib/text";
import { Avatar, EntityLogo, ProfileCover } from "@/components/ui/avatar";
import { Badge, EmptyState, KeyValue, ListSkeleton, Skeleton } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { RelationshipActions } from "@/components/relationship-actions";
import { RichText } from "@/components/rich-text";
import { PostList } from "@/components/post-card";
import type { Viewer } from "@/server/auth/types";
import { Comb, Metrics, Module, type Metric } from "@/components/colmeia/blocks";
import { PixelIcon, type PixelIconName } from "@/components/colmeia/pixel-icon";
import { PeopleYouMayKnow, RecommendedOpportunities, SavedPreview } from "@/components/sidebar";
import { BackLink } from "@/components/colmeia/back-link";
import { ProjectThumb } from "@/components/colmeia/project-thumb";
import type { PublicProfile } from "@/server/profiles";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const TABS = [
  { id: "posts", label: "Posts", icon: "comment" },
  { id: "projects", label: "Projects", icon: "briefcase" },
  { id: "about", label: "About", icon: "users" },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: PixelIconName;
}[];
type TabId = (typeof TABS)[number]["id"];
type Profile = Extract<PublicProfile, { restricted: false }>;

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const tab: TabId = TABS.find((t) => t.id === sp.tab)?.id ?? "posts";
  const viewer = await getViewer();
  const p = await getPublicProfile(viewer, decodeURIComponent(username));
  if (!p) notFound();
  if (p.restricted) {
    return (
      <EmptyState
        icon={<Lock />}
        title={`${p.displayName}'s profile is visible to members only`}
        action={<ButtonLink href={`/login?next=/u/${p.username}`}>Sign in to view</ButtonLink>}
      >
        Sign in or create an account to see this profile.
      </EmptyState>
    );
  }
  const [messageAllowed, completeness] = await Promise.all([
    viewer && !p.isSelf ? canMessage(viewer.id, p.id).then((r) => r.allowed) : false,
    p.isSelf ? profileCompleteness(p.id) : null,
  ]);
  const nextStep = completeness?.steps.find((s) => !s.done);
  const base = `/u/${p.username}`;
  const metrics: Metric[] = [
    ...(p.connectionCount !== null
      ? [
          {
            label: "Connections",
            value: p.connectionCount,
            href: `${base}/connections`,
          },
        ]
      : []),
    {
      label: "Followers",
      value: p.followerCount,
      href: `${base}/connections?tab=followers`,
    },
    {
      label: "Following",
      value: p.followingCount,
      href: `${base}/connections?tab=following`,
    },
  ];
  const availability = p.availability.includes("UNAVAILABLE") ? [availabilityLabels.UNAVAILABLE] : p.availability.map((a) => availabilityLabels[a]);

  return (
    <div className="cm-columns cm-columns-profile">
      <div className="flex min-w-0 flex-col">
        <header className="panel cm-hero" aria-labelledby="profile-name">
          <div className="relative">
            <ProfileCover imageKey={p.coverKey} art={p.coverArt} seed={p.username} className="cm-hero-cover" alt />
            <BackLink fallback={viewer ? "/feed" : "/discover"} className="cm-cover-back" />
          </div>
          <div className="cm-hero-body">
            <div className="cm-hero-top">
              <div className="cm-hero-id">
                <Avatar name={p.displayName} imageKey={p.avatarKey} art={p.avatarArt} size="xl" />
                <div className="cm-hero-who">
                  <h1 id="profile-name">{p.displayName}</h1>
                  <p className="mt-1 text-[13px] text-muted [overflow-wrap:anywhere]">
                    @{p.username}
                    {p.location && <> · {p.location}</>}
                  </p>
                </div>
              </div>
              <Metrics items={metrics} />
            </div>
            {p.headline && <p className="mt-2 font-semibold [overflow-wrap:anywhere]">{p.headline}</p>}
            {availability.length > 0 && <p className="text-[13px] text-muted">{availability.join(" · ")}</p>}
            {p.mutual.count > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                {p.mutual.count} mutual connection
                {p.mutual.count === 1 ? "" : "s"}, including{" "}
                {p.mutual.users.map((u, i) => (
                  <span key={u.id}>
                    {i > 0 && ", "}
                    <Link href={`/u/${u.username}`} className="font-semibold text-ink-2 hover:underline">
                      {u.profile?.displayName}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {nextStep && completeness && (
              <p className="mt-1.5 text-[13px]">
                <Link href={nextStep.href} className="link font-semibold">
                  Get discovered {completeness.done}/{completeness.total}: {nextStep.label.toLowerCase()}
                </Link>
              </p>
            )}
            <div className="mt-3">
              {viewer ? (
                <RelationshipActions userId={p.id} name={p.displayName} rel={p.relationship} canMessage={messageAllowed} verified={viewer.emailVerified} />
              ) : (
                <ButtonLink href={`/login?next=${base}`}>Sign in to connect</ButtonLink>
              )}
            </div>
          </div>
        </header>

        <nav className="cm-tabs" aria-label="Profile sections">
          {TABS.map((t) => (
            <Link key={t.id} href={t.id === "posts" ? base : `${base}?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} scroll={false}>
              <PixelIcon name={t.icon} size={17} />
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "posts" && (
          <section aria-label={`Posts by ${p.displayName}`}>
            <Suspense fallback={<ListSkeleton rows={2} />}>
              <ProfilePosts viewer={viewer} userId={p.id} name={p.displayName} />
            </Suspense>
          </section>
        )}
        {tab === "projects" && <ProjectsTab p={p} />}
        {tab === "about" && <AboutTab p={p} />}
      </div>

      <aside className="cm-aside" aria-label={viewer ? "Saved items, opportunities and people" : "Join BeeHub"}>
        {viewer ? (
          <>
            {p.isSelf && (
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <SavedPreview viewer={viewer} />
              </Suspense>
            )}
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <RecommendedOpportunities viewer={viewer} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <PeopleYouMayKnow viewer={viewer} />
            </Suspense>
          </>
        ) : (
          <Module id="rail-join" title="Join the hive" icon="bee">
            <p className="py-2 text-[13px]">Create a free account to connect with {p.displayName.split(" ")[0]}, follow projects and find where you can help.</p>
            <ButtonLink href="/signup" className="mb-2 w-full">
              Join BeeHub
            </ButtonLink>
          </Module>
        )}
        <Comb className="cm-comb-corner hidden lg:block" />
      </aside>
    </div>
  );
}

function EmptyTile({ children }: { children: React.ReactNode }) {
  return <p className="panel cm-tile text-sm text-muted">{children}</p>;
}

function TileTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-lg font-bold leading-tight">
      {children}
    </h2>
  );
}

function ProjectsTab({ p }: { p: Profile }) {
  const projects = [...p.projectsCreated, ...p.projectsParticipating];
  if (projects.length === 0 && p.organizations.length === 0) return <EmptyTile>No public projects or organizations yet.</EmptyTile>;
  return (
    <div className="flex flex-col gap-2">
      {projects.length > 0 && (
        <div className="cm-tiles">
          {projects.map((m, i) => (
            <article key={m.project.id} className={`panel cm-comb-tile ${i % 2 ? "cm-tile-alt" : ""}`} aria-labelledby={`project-${m.project.id}`}>
              <ProjectThumb project={m.project} />
              <TileTitle id={`project-${m.project.id}`}>
                <Link href={`/p/${m.project.slug}`} className="hover:underline">
                  {m.project.name}
                </Link>
              </TileTitle>
              <p className="mt-0.5 text-xs text-muted">
                {m.title ?? memberRoleLabels[m.role]} · {projectStageLabels[m.project.stage]} · {projectCategoryLabels[m.project.category]}
                {m.project.visibility === "PRIVATE" && " · Private"}
              </p>
              <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{m.project.summary}</p>
            </article>
          ))}
        </div>
      )}
      {p.organizations.length > 0 && (
        <section className="panel cm-tile" aria-labelledby="profile-orgs">
          <TileTitle id="profile-orgs">Organizations</TileTitle>
          <ul className="mt-2 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {p.organizations.map((m) => (
              <li key={m.organization.id}>
                <Link href={`/o/${m.organization.slug}`} className="flex min-h-11 items-center gap-2.5 hover:[&_strong]:underline">
                  <EntityLogo name={m.organization.name} imageKey={m.organization.logoKey} kind="org" size="sm" />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{m.organization.name}</strong>
                    <span className="block text-xs text-muted">{m.title ?? memberRoleLabels[m.role]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AboutTab({ p }: { p: Profile }) {
  const first = p.displayName.split(" ")[0];
  const details = [
    {
      label: "Experience",
      value: p.experienceLevel ? experienceLabels[p.experienceLevel] : null,
    },
    {
      label: "Languages",
      value: p.languages.length ? p.languages.join(", ") : null,
    },
    {
      label: "Work mode",
      value: p.preferredWorkModes.length ? p.preferredWorkModes.map((w) => workModeLabels[w]).join(", ") : null,
    },
    { label: "Member since", value: formatDate(p.memberSince) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <section className="panel cm-tile" aria-labelledby="about-bio">
        <TileTitle id="about-bio">About {first}</TileTitle>
        {p.bio ? <RichText text={p.bio} className="mt-1.5 text-sm leading-relaxed text-ink-2" /> : <p className="mt-1.5 text-sm text-muted">No bio yet.</p>}
      </section>

      {(p.skills.length > 0 || p.interests.length > 0) && (
        <section className="panel cm-tile cm-tile-alt" aria-labelledby="about-skills">
          <TileTitle id="about-skills">Skills & interests</TileTitle>
          {p.skills.length > 0 && (
            <div className="cm-skill-list mt-2">
              {p.skills.map((t) => (
                <Link key={t.slug} href={`/tags/${t.slug}`}>
                  {t.name}
                </Link>
              ))}
            </div>
          )}
          {p.interests.length > 0 && (
            <>
              <p className="eyebrow mb-1.5 mt-3">Interested in</p>
              <div className="cm-skill-list">
                {p.interests.map((t) => (
                  <Link key={t.slug} href={`/tags/${t.slug}`}>
                    {t.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div className="cm-tiles">
        {p.experiences.length > 0 && (
          <section className="panel cm-tile" aria-labelledby="about-experience">
            <TileTitle id="about-experience">Experience</TileTitle>
            <ol className="mt-2 flex flex-col gap-3.5">
              {p.experiences.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="cm-logo mt-0.5 size-8 text-muted">
                    <span className="bg-sunken">
                      <Building2 className="size-4" aria-hidden />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{e.title}</p>
                    <p className="text-[13px] text-ink-2">
                      {e.organization ? (
                        <Link href={`/o/${e.organization.slug}`} className="hover:underline">
                          {e.organization.name}
                        </Link>
                      ) : (
                        e.company
                      )}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {formatMonth(e.startDate)} – {e.endDate ? formatMonth(e.endDate) : "Present"}
                    </p>
                    {e.description && <p className="prose-plain mt-1 text-[13px] text-ink-2">{e.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {p.educations.length > 0 && (
          <section className="panel cm-tile cm-tile-alt" aria-labelledby="about-education">
            <TileTitle id="about-education">Education</TileTitle>
            <ul className="mt-2 flex flex-col gap-3">
              {p.educations.map((e) => (
                <li key={e.id}>
                  <p className="text-sm font-semibold">{e.school}</p>
                  <p className="text-[13px] text-ink-2">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                  {(e.startYear || e.endYear) && <p className="text-xs text-muted">{[e.startYear, e.endYear].filter(Boolean).join(" – ")}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel cm-tile" aria-labelledby="about-details">
          <TileTitle id="about-details">Details</TileTitle>
          <div className="mt-2">
            <KeyValue items={details} />
          </div>
          {p.preferredCollabs.length > 0 && (
            <>
              <p className="eyebrow mb-1.5 mt-4">Open to</p>
              <div className="flex flex-wrap gap-1.5">
                {p.preferredCollabs.map((c) => (
                  <Badge key={c}>{collaborationLabels[c]}</Badge>
                ))}
              </div>
            </>
          )}
        </section>

        {p.links.length > 0 && (
          <section className="panel cm-tile cm-tile-alt" aria-labelledby="about-links">
            <TileTitle id="about-links">Links</TileTitle>
            <ul className="mt-2 flex flex-col gap-0.5">
              {p.links.map((l) => {
                const url = safeUrl(l.url);
                return url ? (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold">
                      <ExternalLink className="size-3.5" aria-hidden /> {l.label}
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

async function ProfilePosts({ viewer, userId, name }: { viewer: Viewer | null; userId: string; name: string }) {
  const { items } = await listPostsFor(viewer, { authorId: userId, asSelfOnly: true }, { take: 10 });
  if (items.length === 0) return <EmptyTile>{name.split(" ")[0]} hasn&apos;t posted yet.</EmptyTile>;
  return <PostList posts={items} signedIn={!!viewer} tiles />;
}
