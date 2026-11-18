import type { Metadata } from "next";
import Link from "next/link";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProjectForManage } from "@/server/projects";
import { canManageMember, hasRank } from "@/server/authz";
import { memberRoleLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { cancelInvitationAction, inviteToProjectAction, removeProjectMemberAction, transferProjectAction, updateProjectMemberAction } from "@/app/actions/teams";
import { Avatar } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Panel, SectionTitle } from "@/components/ui/misc";
import { InviteForm, MemberRoleSelect } from "@/components/team-controls";

export const metadata: Metadata = { title: "Team" };

export default async function ProjectTeamPage({ params }: PageProps<"/projects/[slug]/manage/team">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/projects/${slug}/manage/team`);
  const { project: p, role } = await orNotFound(getProjectForManage(viewer, decodeURIComponent(slug)));
  const canManage = hasRank(role, "ADMIN");

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Panel>
          <SectionTitle>Invite collaborators</SectionTitle>
          <InviteForm action={inviteToProjectAction} entityField={{ name: "projectId", value: p.id }} actorRole={role} />
        </Panel>
      )}
      <Panel>
        <SectionTitle>Members ({p.members.length})</SectionTitle>
        <ul className="divide-y divide-line">
          {p.members.map((m) => {
            const name = m.user.profile?.displayName ?? m.user.username;
            const manageable = canManage && m.user.id !== viewer.id && canManageMember(role, m.role);
            return (
              <li key={m.user.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={name} imageKey={m.user.profile?.avatarKey} art={m.user.profile?.avatarArt} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${m.user.username}`} className="text-sm font-medium hover:underline">
                    {name}
                  </Link>
                  <p className="text-xs text-muted">
                    {m.title ?? "No title"} · joined {timeAgo(m.joinedAt)}
                    {m.opportunity && (
                      <>
                        {" · via "}
                        <Link href={`/opportunities/${m.opportunity.id}`} className="hover:underline">
                          {m.opportunity.title}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {manageable ? (
                  <MemberRoleSelect action={updateProjectMemberAction} fields={{ projectId: p.id, userId: m.user.id }} role={m.role} actorRole={role} title={m.title} />
                ) : (
                  <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{memberRoleLabels[m.role]}</Badge>
                )}
                {manageable && (
                  <ActionButton action={removeProjectMemberAction} fields={{ projectId: p.id, userId: m.user.id }} variant="ghost" confirm="Remove?">
                    Remove
                  </ActionButton>
                )}
                {role === "OWNER" && m.user.id !== viewer.id && (
                  <ActionButton action={transferProjectAction} fields={{ projectId: p.id, userId: m.user.id }} variant="ghost" confirm="Make owner?">
                    Make owner
                  </ActionButton>
                )}
                {m.user.id === viewer.id && m.role !== "OWNER" && (
                  <ActionButton action={removeProjectMemberAction} fields={{ projectId: p.id, userId: viewer.id }} variant="ghost" confirm="Leave project?">
                    Leave
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      {p.invitations.length > 0 && (
        <Panel>
          <SectionTitle>Pending invitations</SectionTitle>
          <ul className="divide-y divide-line">
            {p.invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{i.invitee.profile?.displayName}</span> <span className="text-muted">@{i.invitee.username}</span>
                  <p className="text-xs text-muted">
                    {memberRoleLabels[i.role]}
                    {i.title ? ` · ${i.title}` : ""} · sent {timeAgo(i.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <ActionButton action={cancelInvitationAction} fields={{ invitationId: i.id }} variant="ghost">
                    Cancel
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
