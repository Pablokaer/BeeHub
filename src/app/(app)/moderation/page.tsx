import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { isStaff } from "@/server/auth/types";
import { listAuditLog, listReports, moderationStats } from "@/server/moderation";
import { reportReasonLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { resolveReportAction } from "@/app/actions/social";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, EmptyState, PageHeader, Panel, Tabs } from "@/components/ui/misc";
import type { ReportStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Moderation" };

export default async function ModerationPage({ searchParams }: PageProps<"/moderation">) {
  const sp = await searchParams;
  const viewer = await requireViewerPage("/moderation");
  if (!isStaff(viewer)) notFound();
  const tab = sp.tab === "audit" ? "audit" : sp.tab === "resolved" ? "resolved" : "open";
  const stats = await moderationStats(viewer);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Moderation" description={`${stats.open} open reports · ${stats.users} active members · ${stats.posts} posts · ${stats.projects} projects`} />
      <Tabs
        label="Moderation"
        items={[
          { href: "/moderation", label: "Open reports", active: tab === "open", count: stats.open },
          { href: "/moderation?tab=resolved", label: "Resolved", active: tab === "resolved" },
          { href: "/moderation?tab=audit", label: "Audit log", active: tab === "audit" },
        ]}
      />
      {tab === "audit" ? <Audit viewerPromise={viewer} /> : <Reports viewer={viewer} status={tab === "open" ? "OPEN" : "ACTIONED"} />}
    </div>
  );
}

async function Reports({ viewer, status }: { viewer: Parameters<typeof listReports>[0]; status: ReportStatus }) {
  const reports = await listReports(viewer, status);
  if (reports.length === 0) return <EmptyState icon={<ShieldCheck />} title="Nothing to review" />;
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => (
        <li key={r.id} className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {r.target.href ? (
                  <Link href={r.target.href} className="hover:underline">
                    {r.target.title}
                  </Link>
                ) : (
                  r.target.title
                )}
              </p>
              <p className="text-xs text-muted">
                {r.targetType} · reported by @{r.reporter?.username ?? "deleted"} · {timeAgo(r.createdAt)} · current status {r.target.status}
              </p>
            </div>
            <Badge tone="danger">{reportReasonLabels[r.reason]}</Badge>
          </div>
          {r.target.body && <p className="prose-plain mt-2 line-clamp-4 rounded-md bg-sunken p-2.5 text-[13px] text-ink-2">{r.target.body}</p>}
          {r.details && <p className="mt-2 text-[13px]"><span className="font-medium">Reporter: </span>{r.details}</p>}
          {r.status === "OPEN" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.targetType !== "USER" && (
                <ActionButton action={resolveReportAction} fields={{ reportId: r.id, action: "remove_content" }} variant="danger" confirm="Remove content?">
                  Remove content
                </ActionButton>
              )}
              {r.targetType === "USER" && (
                <ActionButton action={resolveReportAction} fields={{ reportId: r.id, action: "suspend_user" }} variant="danger" confirm="Suspend account?">
                  Suspend account
                </ActionButton>
              )}
              <ActionButton action={resolveReportAction} fields={{ reportId: r.id, action: "dismiss" }}>
                Dismiss
              </ActionButton>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Resolved by @{r.resolvedBy?.username} {r.resolvedAt ? timeAgo(r.resolvedAt) : ""}
              {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
              {r.target.status === "REMOVED" || r.target.status === "SUSPENDED" ? (
                <span className="ml-2 inline-block">
                  <ActionButton action={resolveReportAction} fields={{ reportId: r.id, action: "restore" }} variant="ghost">
                    Restore
                  </ActionButton>
                </span>
              ) : null}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

async function Audit({ viewerPromise }: { viewerPromise: Parameters<typeof listAuditLog>[0] }) {
  const rows = await listAuditLog(viewerPromise, 150);
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-[13px]">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">When</th>
            <th scope="col" className="px-4 py-2 font-semibold">Actor</th>
            <th scope="col" className="px-4 py-2 font-semibold">Action</th>
            <th scope="col" className="px-4 py-2 font-semibold">Entity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-4 py-2 text-muted">{timeAgo(r.createdAt)}</td>
              <td className="px-4 py-2">{r.actor ? `@${r.actor.username}` : "system"}</td>
              <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted">
                {r.entityType}
                {r.entityId ? `:${r.entityId.slice(0, 10)}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
