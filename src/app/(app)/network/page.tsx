import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listConnectionRequests, listConnections, listFollowRequests } from "@/server/social/graph";
import { suggestPeople } from "@/server/matching";
import { listMyInvitations } from "@/server/invitations";
import { connectAction, removeConnectionAction, startConversationAction } from "@/app/actions/social";
import { PersonCard } from "@/components/entity-cards";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, PageHeader, Panel, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { NetworkTabs } from "./tabs";

export const metadata: Metadata = { title: "My network" };

export default async function NetworkPage() {
  const viewer = await requireViewerPage("/network");
  const [connections, suggestions, requests, followRequests, invitations] = await Promise.all([
    listConnections(viewer.id, { take: 100 }),
    suggestPeople(viewer.id, 8),
    listConnectionRequests(viewer),
    listFollowRequests(viewer),
    listMyInvitations(viewer),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My network" description="People you're connected with and people you might want to meet." />
      <NetworkTabs active="connections" counts={{ requests: requests.incoming.length + followRequests.length, invitations: invitations.length }} />
      {suggestions.length > 0 && (
        <Panel className="mb-4">
          <SectionTitle>People you may know</SectionTitle>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {suggestions.map(({ user, reason }) => (
              <PersonCard
                key={user.id}
                user={user}
                compact
                note={reason}
                actions={
                  viewer.emailVerified && (
                    <ActionButton action={connectAction} fields={{ userId: user.id }}>
                      Connect
                    </ActionButton>
                  )
                }
              />
            ))}
          </div>
        </Panel>
      )}
      <section aria-labelledby="conn-title">
        <h2 id="conn-title" className="mb-2.5 text-[15px] font-semibold">
          Connections ({connections.total})
        </h2>
        {connections.items.length === 0 ? (
          <EmptyState icon={<Users />} title="No connections yet" action={<ButtonLink href="/discover?type=people" size="sm">Find people</ButtonLink>}>
            Connect with collaborators, classmates and people whose work you admire. Connections are mutual and need acceptance.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {connections.items.map((u) => (
              <PersonCard
                key={u.id}
                user={u}
                actions={
                  <>
                    <ActionButton action={startConversationAction} fields={{ userId: u.id }}>
                      Message
                    </ActionButton>
                    <ActionButton action={removeConnectionAction} fields={{ userId: u.id }} variant="ghost" confirm="Remove?">
                      Remove
                    </ActionButton>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
      <p className="mt-6 text-[13px] text-muted">
        Looking for who you follow? See <Link href={`/u/${viewer.username}/connections?tab=following`} className="link">your profile network</Link>.
      </p>
    </div>
  );
}
