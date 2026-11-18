"use client";

import { useState } from "react";
import Link from "next/link";
import { commentAction, deleteCommentAction } from "@/app/actions/social";
import { timeAgo } from "@/lib/format";
import { ActionForm, SubmitButton, Textarea } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { RichText, type MentionRef } from "@/components/rich-text";
import { ReportButton } from "@/components/report-dialog";

type C = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { username: string; profile: { displayName: string; avatarKey: string | null; avatarArt?: string | null; headline: string | null } | null };
  mentions: MentionRef[];
};

function CommentForm({ postId, parentId, onDone, autoFocus }: { postId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  return (
    <ActionForm action={commentAction} resetOnSuccess successToast={false} onSuccess={onDone} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label htmlFor={`c-${parentId ?? "root"}`} className="sr-only">
        {parentId ? "Reply" : "Comment"}
      </label>
      <Textarea id={`c-${parentId ?? "root"}`} name="body" rows={2} maxLength={1500} required placeholder={parentId ? "Write a reply… use @ to mention" : "Add a comment… use @ to mention"} autoFocus={autoFocus} />
      <div className="flex justify-end gap-2">
        {onDone && parentId && (
          <button type="button" onClick={onDone} className="h-8 rounded-md px-2.5 text-[13px] text-muted hover:bg-sunken">
            Cancel
          </button>
        )}
        <SubmitButton size="sm">{parentId ? "Reply" : "Comment"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function CommentItem({ c, viewerId, canModerate, onReply }: { c: C; viewerId: string | null; canModerate: boolean; onReply?: () => void }) {
  const name = c.author.profile?.displayName ?? c.author.username;
  return (
    <div id={`c-${c.id}`} className="flex gap-2.5">
      <Avatar name={name} imageKey={c.author.profile?.avatarKey} art={c.author.profile?.avatarArt} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-sunken px-3 py-2">
          <Link href={`/u/${c.author.username}`} className="text-[13px] font-semibold hover:underline">
            {name}
          </Link>
          {c.author.profile?.headline && <span className="ml-1.5 text-xs text-muted">{c.author.profile.headline}</span>}
          <RichText text={c.body} mentions={c.mentions} className="mt-0.5 text-sm text-ink" />
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-muted">
          <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
          {viewerId && onReply && (
            <button type="button" onClick={onReply} className="font-medium hover:text-ink">
              Reply
            </button>
          )}
          {viewerId && (c.authorId === viewerId || canModerate) && (
            <ActionButton action={deleteCommentAction} fields={{ commentId: c.id }} variant="ghost" size="sm" className="h-6 px-1 text-xs" confirm="Delete?">
              Delete
            </ActionButton>
          )}
          {viewerId && c.authorId !== viewerId && <ReportButton targetType="COMMENT" targetId={c.id} />}
        </div>
      </div>
    </div>
  );
}

export function Comments({ postId, comments, viewerId, canComment, canModerate }: { postId: string; comments: (C & { replies: C[] })[]; viewerId: string | null; canComment: boolean; canModerate: boolean }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <section id="comments" aria-label="Comments" className="flex flex-col gap-4">
      {canComment && <CommentForm postId={postId} />}
      {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="flex flex-col gap-3">
          <CommentItem c={c} viewerId={viewerId} canModerate={canModerate} onReply={canComment ? () => setReplyTo(c.id) : undefined} />
          {(c.replies.length > 0 || replyTo === c.id) && (
            <div className="ml-10 flex flex-col gap-3 border-l border-line pl-3">
              {c.replies.map((r) => (
                <CommentItem key={r.id} c={r} viewerId={viewerId} canModerate={canModerate} onReply={canComment ? () => setReplyTo(c.id) : undefined} />
              ))}
              {replyTo === c.id && <CommentForm postId={postId} parentId={c.id} onDone={() => setReplyTo(null)} autoFocus />}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
