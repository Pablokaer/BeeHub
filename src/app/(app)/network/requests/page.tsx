import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listConnectionRequests, listFollowRequests } from "@/server/social/graph";
import { listMyInvitations } from "@/server/invitations";
import { cancelConnectionAction, respondConnectionAction, respondFollowAction } from "@/app/actions/social";
import { timeAgo } from "@/lib/format";
import { PersonCard } from "@/components/entity-cards";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { NetworkTabs } from "../tabs";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  const viewer = await requireViewerPage("/network/requests");
  const [{ incoming, outgoing }, follows, invitations] = await Promise.all([listConnectionRequests(viewer), listFollowRequests(viewer), listMyInvitations(viewer)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My network" />
      <NetworkTabs active="requests" counts={{ requests: incoming.length + follows.length, invitations: invitations.length }} />
      <section className="mb-6">
        <SectionTitle>Connection requests</SectionTitle>
        {incoming.length === 0 ? (
          <EmptyState icon={<Inbox />} title="No pending requests" />
        ) : (
          <div className="flex flex-col gap-3">
            {incoming.map((r) => (
              <PersonCard
                key={r.user.id}
                user={r.user}
                note={
                  <>
                    {r.message && <span className="prose-plain block text-ink-2">“{r.message}”</span>}
                    {timeAgo(r.createdAt)}
                  </>
                }
                actions={
                  <>
                    <ActionButton action={respondConnectionAction} fields={{ userId: r.user.id, accept: "true" }} variant="primary">
                      Accept
                    </ActionButton>
                    <ActionButton action={respondConnectionAction} fields={{ userId: r.user.id, accept: "false" }}>
                      Decline
                    </ActionButton>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
      {follows.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Follow requests</SectionTitle>
          <div className="flex flex-col gap-3">
            {follows.map((f) => (
              <PersonCard
                key={f.follower.id}
                user={f.follower}
                note={timeAgo(f.createdAt)}
                actions={
                  <>
                    <ActionButton action={respondFollowAction} fields={{ userId: f.follower.id, accept: "true" }} variant="primary">
                      Approve
                    </ActionButton>
                    <ActionButton action={respondFollowAction} fields={{ userId: f.follower.id, accept: "false" }}>
                      Decline
                    </ActionButton>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionTitle>Sent requests</SectionTitle>
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted">No pending requests sent.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {outgoing.map((r) => (
              <PersonCard
                key={r.user.id}
                user={r.user}
                note={`Sent ${timeAgo(r.createdAt)}`}
                actions={
                  <ActionButton action={cancelConnectionAction} fields={{ userId: r.user.id }} variant="ghost">
                    Withdraw
                  </ActionButton>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
