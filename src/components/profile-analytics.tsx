import Link from "next/link";
import { ArrowUpRight, ChartNoAxesColumnIncreasing } from "lucide-react";
import type { Actor } from "@/server/auth/types";
import { personalAnalytics } from "@/server/analytics";

export async function ProfileAnalytics({ viewer }: { viewer: Actor }) {
  const analytics = await personalAnalytics(viewer);
  return (
    <section aria-labelledby="profile-analytics-heading" className="border-t border-line py-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 id="profile-analytics-heading" className="text-sm font-semibold">Your analytics</h2><ChartNoAxesColumnIncreasing className="size-4 text-accent" aria-hidden /></div>
      <dl className="flex flex-col gap-1 text-[13px]">
        {[
          { label: "Followers", value: analytics.followers, href: "/analytics" },
          { label: "Connections", value: analytics.connections, href: "/analytics" },
          { label: "Posts · 30 days", value: analytics.posts, href: "/analytics" },
          { label: "Interactions · 30 days", value: analytics.interactions, href: "/analytics" },
        ].map(metric => <div key={metric.label} className="flex min-h-8 items-center justify-between gap-3"><dt className="text-ink-2"><Link href={metric.href} className="hover:text-accent hover:underline">{metric.label}</Link></dt><dd className="font-semibold tabular-nums text-accent">{metric.value.toLocaleString("en")}</dd></div>)}
      </dl>
      <Link href="/analytics" className="mt-3 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-accent">View analytics <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      <p className="mt-1 text-xs text-muted">Only visible to you</p>
    </section>
  );
}
