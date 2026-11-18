import type { Metadata } from "next";
import Link from "next/link";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getOrganizationForManage } from "@/server/organizations";
import { canManageMember, hasRank } from "@/server/authz";
import { memberRoleLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { cancelInvitationAction, inviteToOrgAction, removeOrgMemberAction, transferOrgAction, updateOrgMemberAction } from "@/app/actions/teams";
import { Avatar } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Panel, SectionTitle } from "@/components/ui/misc";
import { InviteForm, MemberRoleSelect } from "@/components/team-controls";

export const metadata: Metadata = { title: "Members" };

export default async function OrgMembersPage({ params }: PageProps<"/orgs/[slug]/manage/members">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/orgs/${slug}/manage/members`);
  const { org, role } = await orNotFound(getOrganizationForManage(viewer, decodeURIComponent(slug)));
  const canManage = hasRank(role, "ADMIN");
  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Panel>
          <SectionTitle>Invite members</SectionTitle>
          <p className="mb-3 text-[13px] text-muted">Owners manage everything · Admins manage members and partnerships · Editors edit the page and publish as the organization · Members are listed on the page.</p>
          <InviteForm action={inviteToOrgAction} entityField={{ name: "organizationId", value: org.id }} actorRole={role} />
        </Panel>
      )}
      <Panel>
        <SectionTitle>Members ({org.members.length})</SectionTitle>
        <ul className="divide-y divide-line">
          {org.members.map((m) => {
            const name = m.user.profile?.displayName ?? m.user.username;
            const manageable = canManage && m.user.id !== viewer.id && canManageMember(role, m.role);
            return (
              <li key={m.user.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={name} imageKey={m.user.profile?.avatarKey} art={m.user.profile?.avatarArt} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${m.user.username}`} className="text-sm font-medium hover:underline">
                    {name}
                  </Link>
                  <p className="text-xs text-muted">{m.title ?? m.user.profile?.headline ?? ""}</p>
                </div>
                {manageable ? (
                  <MemberRoleSelect action={updateOrgMemberAction} fields={{ organizationId: org.id, userId: m.user.id }} role={m.role} actorRole={role} />
                ) : (
                  <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{memberRoleLabels[m.role]}</Badge>
                )}
                {manageable && (
                  <ActionButton action={removeOrgMemberAction} fields={{ organizationId: org.id, userId: m.user.id }} variant="ghost" confirm="Remove?">
                    Remove
                  </ActionButton>
                )}
                {role === "OWNER" && m.user.id !== viewer.id && (
                  <ActionButton action={transferOrgAction} fields={{ organizationId: org.id, userId: m.user.id }} variant="ghost" confirm="Make owner?">
                    Make owner
                  </ActionButton>
                )}
                {m.user.id === viewer.id && m.role !== "OWNER" && (
                  <ActionButton action={removeOrgMemberAction} fields={{ organizationId: org.id, userId: viewer.id }} variant="ghost" confirm="Leave?">
                    Leave
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      {org.invitations.length > 0 && (
        <Panel>
          <SectionTitle>Pending invitations</SectionTitle>
          <ul className="divide-y divide-line">
            {org.invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex-1">
                  {i.invitee.profile?.displayName} <span className="text-muted">@{i.invitee.username} · {memberRoleLabels[i.role]} · {timeAgo(i.createdAt)}</span>
                </span>
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
