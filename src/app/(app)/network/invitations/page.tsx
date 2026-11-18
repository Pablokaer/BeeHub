import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listMyInvitations } from "@/server/invitations";
import { listConnectionRequests, listFollowRequests } from "@/server/social/graph";
import { respondInvitationAction } from "@/app/actions/teams";
import { memberRoleLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { EntityLogo } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NetworkTabs } from "../tabs";

export const metadata: Metadata = { title: "Team invitations" };

export default async function InvitationsPage() {
  const viewer = await requireViewerPage("/network/invitations");
  const [invitations, { incoming }, follows] = await Promise.all([listMyInvitations(viewer), listConnectionRequests(viewer), listFollowRequests(viewer)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My network" />
      <NetworkTabs active="invitations" counts={{ requests: incoming.length + follows.length, invitations: invitations.length }} />
      {invitations.length === 0 ? (
        <EmptyState icon={<MailOpen />} title="No pending invitations">When a project or organization invites you to join their team, it shows up here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.map((i) => {
            const entity = i.project ? { name: i.project.name, href: `/p/${i.project.slug}`, logo: i.project.logoKey, kind: "project" as const, about: i.project.summary } : { name: i.organization!.name, href: `/o/${i.organization!.slug}`, logo: i.organization!.logoKey, kind: "org" as const, about: i.organization!.tagline };
            return (
              <li key={i.id} className="panel flex flex-wrap items-start gap-3 p-4">
                <EntityLogo name={entity.name} imageKey={entity.logo} kind={entity.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{i.inviter?.profile?.displayName ?? "Someone"}</span> invited you to join{" "}
                    <Link href={entity.href} className="font-semibold hover:underline">
                      {entity.name}
                    </Link>{" "}
                    as <strong>{i.title ?? memberRoleLabels[i.role]}</strong>
                  </p>
                  {entity.about && <p className="text-[13px] text-muted">{entity.about}</p>}
                  {i.message && <p className="prose-plain mt-1 text-[13px] text-ink-2">“{i.message}”</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(i.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton action={respondInvitationAction} fields={{ invitationId: i.id, accept: "true" }} variant="primary">
                    Join
                  </ActionButton>
                  <ActionButton action={respondInvitationAction} fields={{ invitationId: i.id, accept: "false" }}>
                    Decline
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
