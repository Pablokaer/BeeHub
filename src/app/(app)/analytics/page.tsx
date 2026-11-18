import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { personalAnalytics } from "@/server/analytics";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Your analytics", robots: { index: false, follow: false } };

export default async function AnalyticsPage() {
  const viewer = await requireViewerPage("/analytics");
  const data = await personalAnalytics(viewer);
  return <div>
    <Link href="/feed" className="mb-6 inline-flex items-center gap-2 text-sm text-accent"><ArrowLeft className="size-4" aria-hidden />Back to feed</Link>
    <PageHeader title="Your analytics" description="Understand your network and the response to your personal posts." actions={<span className="inline-flex items-center gap-2 text-xs text-muted"><LockKeyhole className="size-4" aria-hidden />Only visible to you</span>} />
    <p className="mb-6 text-sm text-muted">Last 30 days · {formatDate(data.since)} – {formatDate(data.until)}</p>
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-line py-6 lg:grid-cols-4">
      {[
        {label: "Followers", value: data.followers, detail: "Current total"},
        {label: "Connections", value: data.connections, detail: "Accepted connections"},
        {label: "Personal posts", value: data.posts, detail: "Published in this period"},
        {label: "Interactions received", value: data.interactions, detail: "Likes, comments and reposts"},
      ].map(m => <div key={m.label}><dt className="text-sm text-ink-2">{m.label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums text-accent">{m.value.toLocaleString("en")}</dd><p className="mt-2 text-xs text-muted">{m.detail}</p></div>)}
    </dl>
    <section className="py-8" aria-labelledby="engagement-heading">
      <h2 id="engagement-heading" className="mb-4 text-lg font-semibold">Interactions in the last 30 days</h2>
      <dl className="flex flex-wrap gap-x-12 gap-y-4 text-sm">{[{label:"Likes",value:data.likes},{label:"Comments",value:data.comments},{label:"Reposts",value:data.shares}].map(m=><div key={m.label} className="flex gap-3"><dt className="text-muted">{m.label}</dt><dd className="font-semibold tabular-nums">{m.value}</dd></div>)}</dl>
      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">Counts include interactions from other active members on your published personal posts. Your own actions and posts published as a project or organization are excluded. Deleted content is excluded. Profile views and impressions are not tracked yet.</p>
    </section>
    <section className="border-t border-line py-6" aria-labelledby="recent-posts-heading">
      <h2 id="recent-posts-heading" className="mb-5 text-lg font-semibold">Your recent personal posts</h2>
      {data.recentPosts.length ? <ul className="divide-y divide-line">{data.recentPosts.map(post=><li key={post.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0 flex-1"><Link href={`/posts/${post.id}`} className="line-clamp-2 text-sm font-medium hover:text-accent hover:underline">{post.body.trim() || "Shared post"}</Link><time className="mt-2 block text-xs text-muted" dateTime={post.createdAt.toISOString()}>{formatDate(post.createdAt)}</time></div><p className="text-xs text-ink-2">{post._count.reactions} likes · {post._count.comments} comments · {post._count.reposts} reposts</p></li>)}</ul> : <EmptyState title="No personal posts in this period" action={<ButtonLink href="/feed" size="sm">Share an update</ButtonLink>}>Publish as yourself to start measuring your activity.</EmptyState>}
    </section>
  </div>;
}
