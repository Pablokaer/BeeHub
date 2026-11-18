"use client";

import { commentAction } from "@/app/actions/social";
import { ActionForm, SubmitButton, Textarea } from "./ui/form";

/** Comment or reply composer, shared by the post page and the inline composer under feed posts. */
export function CommentForm({
  postId,
  parentId,
  onDone,
  onCancel,
  autoFocus,
  fieldId,
}: {
  postId: string;
  parentId?: string;
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  fieldId?: string;
}) {
  const id = fieldId ?? `c-${parentId ?? "root"}`;
  return (
    <ActionForm action={commentAction} resetOnSuccess successToast={false} onSuccess={onDone} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label htmlFor={id} className="sr-only">
        {parentId ? "Reply" : "Comment"}
      </label>
      <Textarea id={id} name="body" rows={2} maxLength={1500} required placeholder={parentId ? "Write a reply… use @ to mention" : "Add a comment… use @ to mention"} autoFocus={autoFocus} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-8 rounded-md px-2.5 text-[13px] text-muted hover:bg-sunken">
            Cancel
          </button>
        )}
        <SubmitButton size="sm">{parentId ? "Reply" : "Comment"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
