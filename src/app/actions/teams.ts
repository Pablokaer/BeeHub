"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { inviteSchema, memberRoleSchema, organizationSchema, partnershipRequestSchema, projectSchema } from "@/lib/validation";
import { parse, parseForm, runAction, setFlash } from "@/server/action-utils";
import { requireVerifiedViewer, requireViewer } from "@/server/auth/viewer";
import { createOrganization, removeOrgMember, setOrganizationArchived, transferOrgOwnership, updateOrgMemberRole, updateOrganization } from "@/server/organizations";
import {
  addProjectImage, createProject, removeProjectImage, removeProjectMember, setProjectArchived, transferProjectOwnership, updateProject, updateProjectMember,
} from "@/server/projects";
import { cancelInvitation, inviteToOrganization, inviteToProject, respondToInvitation } from "@/server/invitations";
import { cancelPartnershipRequest, endPartnership, requestPartnership, respondToPartnership } from "@/server/partnerships";
import { ValidationError } from "@/server/errors";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// ───────────── Organizations ─────────────

export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const org = await createOrganization(viewer, parseForm(organizationSchema, formData, ["tags"]));
    await setFlash(`${org.name} is live. Invite your team next.`);
    redirect(`/orgs/${org.slug}/manage/members`);
  });
}

export async function updateOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(organizationSchema, formData, ["tags"]);
    await updateOrganization(viewer, str(formData, "organizationId"), input);
    await setFlash("Organization saved.");
    redirect(`/orgs/${input.slug}/manage`);
  });
}

export async function updateOrgMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateOrgMemberRole(viewer, str(formData, "organizationId"), str(formData, "userId"), parse(memberRoleSchema, str(formData, "role")));
    refresh();
    return { ok: true, message: "Role updated." };
  });
}

export async function removeOrgMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const userId = str(formData, "userId");
    await removeOrgMember(viewer, str(formData, "organizationId"), userId);
    if (userId === viewer.id) {
      await setFlash("You left the organization.");
      redirect("/my-projects");
    }
    refresh();
    return { ok: true, message: "Member removed." };
  });
}

export async function transferOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await transferOrgOwnership(viewer, str(formData, "organizationId"), str(formData, "userId"));
    refresh();
    return { ok: true, message: "Ownership transferred." };
  });
}

export async function archiveOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const archived = str(formData, "archived") === "true";
    await setOrganizationArchived(viewer, str(formData, "organizationId"), archived);
    refresh();
    return { ok: true, message: archived ? "Organization archived." : "Organization restored." };
  });
}

export async function inviteToOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    await inviteToOrganization(viewer, str(formData, "organizationId"), parseForm(inviteSchema, formData));
    refresh();
    return { ok: true, message: "Invitation sent." };
  });
}

// ───────────── Projects ─────────────

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const project = await createProject(viewer, parseForm(projectSchema, formData, ["tech", "topics"]));
    await setFlash(`${project.name} was created. Publish what you're looking for next.`);
    redirect(`/p/${project.slug}`);
  });
}

export async function updateProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(projectSchema, formData, ["tech", "topics"]);
    await updateProject(viewer, str(formData, "projectId"), input);
    await setFlash("Project saved.");
    redirect(`/projects/${input.slug}/manage`);
  });
}

export async function addProjectImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const key = str(formData, "key");
    if (!key) throw new ValidationError("Upload an image first.", { key: "Upload an image first" });
    await addProjectImage(viewer, str(formData, "projectId"), key, str(formData, "caption").slice(0, 200) || undefined);
    refresh();
    return { ok: true, message: "Image added to the gallery." };
  });
}

export async function removeProjectImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeProjectImage(viewer, str(formData, "projectId"), str(formData, "imageId"));
    refresh();
    return { ok: true, message: "Image removed." };
  });
}

export async function updateProjectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const role = formData.get("role") ? parse(memberRoleSchema, str(formData, "role")) : undefined;
    const title = formData.has("title") ? str(formData, "title").trim().slice(0, 80) || null : undefined;
    await updateProjectMember(viewer, str(formData, "projectId"), str(formData, "userId"), { role, title });
    refresh();
    return { ok: true, message: "Member updated." };
  });
}

export async function removeProjectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const userId = str(formData, "userId");
    await removeProjectMember(viewer, str(formData, "projectId"), userId);
    if (userId === viewer.id) {
      await setFlash("You left the project.");
      redirect("/my-projects");
    }
    refresh();
    return { ok: true, message: "Member removed." };
  });
}

export async function transferProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await transferProjectOwnership(viewer, str(formData, "projectId"), str(formData, "userId"));
    refresh();
    return { ok: true, message: "Ownership transferred." };
  });
}

export async function archiveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const archived = str(formData, "archived") === "true";
    await setProjectArchived(viewer, str(formData, "projectId"), archived);
    refresh();
    return { ok: true, message: archived ? "Project archived; open opportunities were closed." : "Project restored." };
  });
}

export async function inviteToProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    await inviteToProject(viewer, str(formData, "projectId"), parseForm(inviteSchema, formData));
    refresh();
    return { ok: true, message: "Invitation sent." };
  });
}

// ───────────── Invitations ─────────────

export async function respondInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const accept = str(formData, "accept") === "true";
    const inv = await respondToInvitation(viewer, str(formData, "invitationId"), accept);
    if (accept) {
      await setFlash(`Welcome to ${inv.project?.name ?? inv.organization?.name}!`);
      redirect(inv.project ? `/p/${inv.project.slug}` : `/o/${inv.organization!.slug}`);
    }
    refresh();
    return { ok: true, message: "Invitation declined." };
  });
}

export async function cancelInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await cancelInvitation(viewer, str(formData, "invitationId"));
    refresh();
    return { ok: true, message: "Invitation canceled." };
  });
}

// ───────────── Partnerships ─────────────

function entityRef(kind: string, id: string) {
  if (kind === "project" || kind === "p") return { projectId: id };
  if (kind === "org" || kind === "o") return { organizationId: id };
  throw new ValidationError("Choose a project or organization.");
}

export async function requestPartnershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const input = parseForm(partnershipRequestSchema, formData);
    if (input.from === "user") throw new ValidationError(undefined, { from: "Choose one of your projects or organizations" });
    const [kind, id] = input.from.split(":");
    const result = await requestPartnership(viewer, entityRef(kind, id), entityRef(input.targetType, input.targetId), input.message);
    refresh();
    return { ok: true, message: result.accepted ? "You're now partners!" : "Partnership request sent." };
  });
}

export async function respondPartnershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const accept = str(formData, "accept") === "true";
    await respondToPartnership(viewer, str(formData, "partnershipId"), accept);
    refresh();
    return { ok: true, message: accept ? "Partnership accepted. It now shows on both pages." : "Request declined." };
  });
}

export async function cancelPartnershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await cancelPartnershipRequest(viewer, str(formData, "partnershipId"));
    refresh();
    return { ok: true, message: "Request canceled." };
  });
}

export async function endPartnershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await endPartnership(viewer, str(formData, "partnershipId"));
    refresh();
    return { ok: true, message: "Partnership ended." };
  });
}
