import type { Metadata } from "next";
import { Suspense } from "react";
import { Newspaper } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { getFeed, type FeedMode } from "@/server/feed";
import { listPublishIdentities } from "@/server/authz";
import { Comb, StreamTitle } from "@/components/colmeia/blocks";
import { GrowingProjects, SponsoredProjects } from "@/components/project-highlights";
import { Composer } from "@/components/composer";
import { PostCard } from "@/components/post-card";
import { PeopleYouMayKnow, ProfileSummary, RecommendedOpportunities, TrendingTags } from "@/components/sidebar";
import { EmptyState, ListSkeleton, Skeleton, Tabs } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Home" };

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const sp = await searchParams;
  const viewer = await requireViewerPage("/feed");
  const mode: FeedMode = sp.mode === "latest" ? "latest" : "for-you";
  const page = Math.max(1, Number(sp.page) || 1);
  const identities = await listPublishIdentities(viewer.id);
  const options = [
    { value: "user", label: viewer.displayName },
    ...identities.projects.map((p) => ({ value: `project:${p.id}`, label: p.name })),
    ...identities.orgs.map((o) => ({ value: `org:${o.id}`, label: o.name })),
  ];

  return (
    <div className="cm-columns">
      <div className="flex min-w-0 flex-col gap-2.5">
        <StreamTitle title="Hive feed" />
        {viewer.emailVerified ? (
          <Composer
            viewerName={viewer.displayName}
            viewerAvatar={viewer.avatarKey}
            viewerArt={viewer.avatarArt}
            identities={options}
            placeholder={`What are you building, ${viewer.displayName.split(" ")[0]}?`}
          />
        ) : (
          <div className="panel p-4 text-sm text-muted">Confirm your email to start posting. Check the banner above.</div>
        )}
        <Tabs
          label="Feed mode"
          items={[
            { href: "/feed", label: "For you", active: mode === "for-you" },
            { href: "/feed?mode=latest", label: "Latest from your network", active: mode === "latest" },
          ]}
        />
        <Suspense key={`${mode}-${page}`} fallback={<ListSkeleton rows={3} />}>
          <FeedItems viewer={viewer} mode={mode} page={page} />
        </Suspense>
      </div>
      <aside aria-label="Your profile, opportunities and people" className="cm-aside">
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <ProfileSummary viewer={viewer} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <RecommendedOpportunities viewer={viewer} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <PeopleYouMayKnow viewer={viewer} />
        </Suspense>
        <Suspense fallback={null}>
          <SponsoredProjects />
        </Suspense>
        <Suspense fallback={null}>
          <GrowingProjects />
        </Suspense>
        <Suspense fallback={null}>
          <TrendingTags />
        </Suspense>
        <Comb className="cm-comb-corner hidden lg:block" />
      </aside>
    </div>
  );
}

async function FeedItems({ viewer, mode, page }: { viewer: Awaited<ReturnType<typeof requireViewerPage>>; mode: FeedMode; page: number }) {
  const feed = await getFeed(viewer, { mode, page });
  if (feed.items.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper />}
        title={mode === "latest" ? "Nothing from your network yet" : "Your feed is quiet"}
        action={
          <div className="flex gap-2">
            <ButtonLink href="/discover?type=people" variant="secondary" size="sm">
              Find people
            </ButtonLink>
            <ButtonLink href="/discover?type=projects" size="sm">
              Follow projects
            </ButtonLink>
          </div>
        }
      >
        Connect with people and follow projects and organizations to see their updates here.
      </EmptyState>
    );
  }
  const base = mode === "latest" ? "/feed?mode=latest&" : "/feed?";
  return (
    <div className="flex flex-col gap-2.5">
      {feed.items.map(({ post, reason }) => (
        <PostCard key={post.id} post={post} signedIn reason={reason} />
      ))}
      <nav aria-label="Feed pages" className="flex justify-between gap-2">
        {page > 1 ? <ButtonLink href={`${base}page=${page - 1}`} variant="secondary" size="sm" rel="prev">← Newer</ButtonLink> : <span />}
        {feed.hasMore && <ButtonLink href={`${base}page=${page + 1}`} variant="secondary" size="sm" rel="next">Older →</ButtonLink>}
      </nav>
    </div>
  );
}
