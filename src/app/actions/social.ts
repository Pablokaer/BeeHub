"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { commentSchema, messageSchema, postSchema, reportSchema } from "@/lib/validation";
import { parseForm, runAction, setFlash } from "@/server/action-utils";
import { requireVerifiedViewer, requireViewer } from "@/server/auth/viewer";
import {
  blockUser, cancelConnectionRequest, follow, removeConnection, respondToConnectionRequest, respondToFollowRequest,
  sendConnectionRequest, unfollow, type FollowTarget,
} from "@/server/social/graph";
import { addComment, createPost, deleteComment, deletePost, toggleLike, toggleSave } from "@/server/posts";
import { sendMessage, startConversation } from "@/server/messaging";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notifications";
import { fileReport, resolveReport, setUserSuspended, type ModerationAction } from "@/server/moderation";
import { ValidationError } from "@/server/errors";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function followTarget(fd: FormData): FollowTarget {
  const kind = str(fd, "kind");
  const id = str(fd, "id");
  if (kind === "user") return { userId: id };
  if (kind === "org") return { organizationId: id };
  if (kind === "project") return { projectId: id };
  throw new ValidationError("Unknown target.");
}

// ───────────── Graph ─────────────

export async function connectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const r = await sendConnectionRequest(viewer, str(formData, "userId"), str(formData, "message").trim().slice(0, 300) || undefined);
    refresh();
    return { ok: true, message: r.status === "accepted" ? "You're now connected." : "Connection request sent." };
  });
}

export async function respondConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const accept = str(formData, "accept") === "true";
    await respondToConnectionRequest(viewer, str(formData, "userId"), accept);
    refresh();
    return { ok: true, message: accept ? "Connected." : "Request declined." };
  });
}

export async function cancelConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await cancelConnectionRequest(viewer, str(formData, "userId"));
    refresh();
    return { ok: true, message: "Request canceled." };
  });
}

export async function removeConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeConnection(viewer, str(formData, "userId"));
    refresh();
    return { ok: true, message: "Connection removed." };
  });
}

export async function followAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const status = await follow(viewer, followTarget(formData));
    refresh();
    return { ok: true, message: status === "PENDING" ? "Follow request sent." : "Following." };
  });
}

export async function unfollowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await unfollow(viewer, followTarget(formData));
    refresh();
    return { ok: true, message: "Unfollowed." };
  });
}

export async function respondFollowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const accept = str(formData, "accept") === "true";
    await respondToFollowRequest(viewer, str(formData, "userId"), accept);
    refresh();
    return { ok: true, message: accept ? "Follow request approved." : "Follow request declined." };
  });
}

export async function blockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await blockUser(viewer, str(formData, "userId"));
    await setFlash("Blocked. They can't see your profile, message you or interact with you.", "info");
    redirect("/settings/blocked");
  });
}

// ───────────── Posts ─────────────

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const input = parseForm(postSchema, formData, ["imageKeys"]);
    await createPost(viewer, input);
    refresh();
    return { ok: true, message: input.repostOfId && !input.body ? "Shared to your feed." : "Posted." };
  });
}

export async function deletePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deletePost(viewer, str(formData, "postId"));
    if (formData.get("redirect")) {
      await setFlash("Post deleted.");
      redirect("/feed");
    }
    refresh();
    return { ok: true, message: "Post deleted." };
  });
}

export async function toggleLikeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const r = await toggleLike(viewer, str(formData, "postId"));
    refresh();
    return { ok: true, data: r };
  });
}

export async function toggleSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const r = await toggleSave(viewer, str(formData, "postId"));
    refresh();
    return { ok: true, message: r.saved ? "Saved for later." : "Removed from saved.", data: r };
  });
}

export async function commentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    await addComment(viewer, parseForm(commentSchema, formData));
    refresh();
    return { ok: true };
  });
}

export async function deleteCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteComment(viewer, str(formData, "commentId"));
    refresh();
    return { ok: true, message: "Comment deleted." };
  });
}

// ───────────── Messages ─────────────

export async function startConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const id = await startConversation(viewer, str(formData, "userId"));
    redirect(`/messages/${id}`);
  });
}

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const input = parseForm(messageSchema, formData);
    await sendMessage(viewer, str(formData, "conversationId"), input.body);
    refresh();
    return { ok: true };
  });
}

// ───────────── Notifications ─────────────

export async function markNotificationReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await markNotificationRead(viewer, str(formData, "id"));
    const href = str(formData, "href");
    if (href.startsWith("/") && !href.startsWith("//")) redirect(href);
    refresh();
    return { ok: true };
  });
}

export async function markAllNotificationsReadAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await markAllNotificationsRead(viewer);
    refresh();
    return { ok: true, message: "All caught up." };
  });
}

// ───────────── Reports & moderation ─────────────

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await fileReport(viewer, parseForm(reportSchema, formData));
    return { ok: true, message: "Thanks. Our moderators will review this report." };
  });
}

export async function resolveReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const action = str(formData, "action") as ModerationAction;
    if (!["dismiss", "remove_content", "suspend_user", "restore"].includes(action)) throw new ValidationError("Unknown action.");
    await resolveReport(viewer, str(formData, "reportId"), action, str(formData, "note").slice(0, 500) || undefined);
    refresh();
    return { ok: true, message: "Report resolved." };
  });
}

export async function suspendUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setUserSuspended(viewer, str(formData, "userId"), str(formData, "suspended") === "true");
    refresh();
    return { ok: true, message: "Account status updated." };
  });
}
