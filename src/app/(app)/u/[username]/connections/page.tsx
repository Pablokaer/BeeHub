import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { getPublicProfile } from "@/server/profiles";
import { listConnections, listFollowers, listFollowing } from "@/server/social/graph";
import { PersonCard } from "@/components/entity-cards";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { EntityLogo } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Connections" };

export default async function ProfileConnectionsPage({ params, searchParams }: PageProps<"/u/[username]/connections">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  const p = await getPublicProfile(viewer, decodeURIComponent(username));
  if (!p || p.restricted) notFound();
  const tab = sp.tab === "followers" ? "followers" : sp.tab === "following" ? "following" : "connections";
  const base = `/u/${p.username}/connections`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={<Link href={`/u/${p.username}`} className="hover:underline">{p.displayName}</Link>} title="Network" />
      <Tabs
        label="Network"
        items={[
          { href: base, label: "Connections", active: tab === "connections" },
          { href: `${base}?tab=followers`, label: "Followers", active: tab === "followers", count: p.followerCount },
          { href: `${base}?tab=following`, label: "Following", active: tab === "following", count: p.followingCount },
        ]}
      />
      {tab === "connections" &&
        (p.connectionCount === null ? (
          <EmptyState title="Connections are private">{p.displayName} only shares their connections with selected people.</EmptyState>
        ) : (
          <ConnectionsList userId={p.id} />
        ))}
      {tab === "followers" && <Followers userId={p.id} />}
      {tab === "following" && <Following userId={p.id} />}
    </div>
  );
}

async function ConnectionsList({ userId }: { userId: string }) {
  const { items } = await listConnections(userId, { take: 100 });
  if (items.length === 0) return <EmptyState title="No connections yet" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((u) => (
        <PersonCard key={u.id} user={u} />
      ))}
    </div>
  );
}

async function Followers({ userId }: { userId: string }) {
  const users = await listFollowers(userId, 100);
  if (users.length === 0) return <EmptyState title="No followers yet" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {users.map((u) => (
        <PersonCard key={u.id} user={u} />
      ))}
    </div>
  );
}

async function Following({ userId }: { userId: string }) {
  const rows = await listFollowing(userId, 100);
  const visible = rows.filter((r) => r.user || (r.organization?.status === "ACTIVE") || (r.project?.status === "ACTIVE" && r.project.visibility === "PUBLIC"));
  if (visible.length === 0) return <EmptyState title="Not following anyone yet" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((r, i) =>
        r.user ? (
          <PersonCard key={i} user={r.user} />
        ) : r.organization ? (
          <Link key={i} href={`/o/${r.organization.slug}`} className="panel flex items-center gap-3 p-4 hover:border-line-strong">
            <EntityLogo name={r.organization.name} imageKey={r.organization.logoKey} kind="org" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{r.organization.name}</span>
              <span className="block truncate text-xs text-muted">Organization · {r.organization.tagline}</span>
            </span>
          </Link>
        ) : r.project ? (
          <Link key={i} href={`/p/${r.project.slug}`} className="panel flex items-center gap-3 p-4 hover:border-line-strong">
            <EntityLogo name={r.project.name} imageKey={r.project.logoKey} kind="project" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{r.project.name}</span>
              <span className="block truncate text-xs text-muted">Project · {r.project.summary}</span>
            </span>
          </Link>
        ) : null,
      )}
    </div>
  );
}
