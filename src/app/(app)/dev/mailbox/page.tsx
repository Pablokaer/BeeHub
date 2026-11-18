import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { getViewer } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { timeAgo } from "@/lib/format";
import { RichText } from "@/components/rich-text";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Dev mailbox", robots: { index: false } };

/** Development-only view of the email outbox (verification, reset, digests). Disabled in production. */
export default async function DevMailboxPage() {
  await connection();
  if (env().NODE_ENV === "production") notFound();
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN") notFound();
  const emails = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Development only" title="Mailbox" description="Emails are stored here when no SMTP server is configured (SMTP_URL)." />
      {emails.length === 0 ? (
        <EmptyState title="No emails yet" />
      ) : (
        <ul className="flex flex-col gap-3">
          {emails.map((e) => (
            <li key={e.id} className="panel p-4">
              <p className="text-sm font-semibold">{e.subject}</p>
              <p className="text-xs text-muted">
                to {e.to} · {e.kind} · {e.status} · {timeAgo(e.createdAt)}
              </p>
              <RichText text={e.text} className="mt-2 text-[13px] text-ink-2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
