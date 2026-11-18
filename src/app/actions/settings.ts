"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { NotificationType } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import { notificationTypeLabels } from "@/lib/constants";
import { changeEmailSchema, changePasswordSchema, confirmPasswordSchema, educationSchema, experienceSchema, privacySchema, profileSchema } from "@/lib/validation";
import { parseForm, runAction, setFlash } from "@/server/action-utils";
import { changeEmail, changePassword, deactivateAccount, deleteAccount, revokeOtherSessions, revokeSession } from "@/server/auth/service";
import { endSession, getSessionToken, requireViewer } from "@/server/auth/viewer";
import { deleteEducation, deleteExperience, updatePrivacy, updateProfile, upsertEducation, upsertExperience } from "@/server/profiles";
import { updateNotificationPreferences } from "@/server/notifications";
import { unblockUser } from "@/server/social/graph";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(profileSchema, formData, ["skills", "interests", "availability", "preferredWorkModes", "preferredCollabs", "languages"]);
    await updateProfile(viewer, input);
    refresh();
    return { ok: true, message: "Profile saved." };
  });
}

export async function saveExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await upsertExperience(viewer, parseForm(experienceSchema, formData));
    refresh();
    return { ok: true, message: "Experience saved." };
  });
}

export async function deleteExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteExperience(viewer, String(formData.get("id")));
    refresh();
    return { ok: true, message: "Experience removed." };
  });
}

export async function saveEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await upsertEducation(viewer, parseForm(educationSchema, formData));
    refresh();
    return { ok: true, message: "Education saved." };
  });
}

export async function deleteEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteEducation(viewer, String(formData.get("id")));
    refresh();
    return { ok: true, message: "Education removed." };
  });
}

export async function updatePrivacyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updatePrivacy(viewer, parseForm(privacySchema, formData));
    refresh();
    return { ok: true, message: "Privacy settings saved." };
  });
}

export async function updateNotificationPrefsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const types = Object.keys(notificationTypeLabels) as NotificationType[];
    await updateNotificationPreferences(
      viewer,
      types.map((type) => ({ type, inApp: formData.get(`inApp:${type}`) === "on", email: formData.get(`email:${type}`) === "on" })),
    );
    refresh();
    return { ok: true, message: "Notification preferences saved." };
  });
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(changePasswordSchema, formData);
    await changePassword(viewer, input.currentPassword, input.password, await getSessionToken());
    return { ok: true, message: "Password changed. Other sessions were signed out." };
  });
}

export async function changeEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(changeEmailSchema, formData);
    await changeEmail(viewer, input.email, input.currentPassword);
    refresh();
    return { ok: true, message: `Email updated. Confirm it using the link we sent to ${input.email}.` };
  });
}

export async function revokeSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await revokeSession(viewer, String(formData.get("id")));
    refresh();
    return { ok: true, message: "Session signed out." };
  });
}

export async function revokeOtherSessionsAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await revokeOtherSessions(viewer, await getSessionToken());
    refresh();
    return { ok: true, message: "Signed out of all other sessions." };
  });
}

export async function unblockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await unblockUser(viewer, String(formData.get("userId")));
    refresh();
    return { ok: true, message: "Unblocked." };
  });
}

export async function deactivateAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(confirmPasswordSchema, formData);
    await deactivateAccount(viewer, input.currentPassword);
    await endSession();
    await setFlash("Your account is deactivated. Sign in again any time to reactivate it.", "info");
    redirect("/");
  });
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseForm(confirmPasswordSchema, formData);
    if (formData.get("confirm") !== "DELETE") return { ok: false, message: "Type DELETE to confirm.", fieldErrors: { confirm: "Type DELETE to confirm" } };
    await deleteAccount(viewer, input.currentPassword);
    await endSession();
    await setFlash("Your account and personal data were deleted.", "info");
    redirect("/");
  });
}
