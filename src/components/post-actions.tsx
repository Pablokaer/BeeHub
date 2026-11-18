"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { PixelIcon } from "./colmeia/pixel-icon";
import { toggleLikeAction, toggleSaveAction, createPostAction, deletePostAction } from "@/app/actions/social";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton, Textarea } from "./ui/form";
import { ReportDialog } from "./report-dialog";
import { useToast } from "./ui/toast";
import { cn } from "./ui/cn";

const btn = "inline-flex min-h-10 min-w-11 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50";
/** Pixel glyphs read as "off" until the action is active (state is also exposed via aria-pressed). */
const glyphOff = "opacity-60 grayscale";

export function PostActions({
  postId,
  shareTargetId,
  liked,
  likeCount,
  commentCount,
  shareCount,
  saved,
  signedIn,
  commentsHref,
}: {
  postId: string;
  shareTargetId: string;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saved: boolean;
  signedIn: boolean;
  commentsHref: string;
}) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic({ liked, likeCount }, (s, next: boolean) => ({ liked: next, likeCount: s.likeCount + (next ? 1 : -1) }));
  const withToast = (fn: (p: ActionState, f: FormData) => Promise<ActionState>) => async (p: ActionState, f: FormData) => {
    const r = await fn(p, f);
    if (r && !r.ok) toast(r.message, "error");
    else if (r?.ok && r.message) toast(r.message, "success");
    return r;
  };
  const [, likeAction, liking] = useActionState(withToast(toggleLikeAction), null);
  const [, saveAction] = useActionState(withToast(toggleSaveAction), null);
  const [, shareAction, sharing] = useActionState(withToast(createPostAction), null);
  const [quoting, setQuoting] = useState(false);

  if (!signedIn) {
    return (
      <div className="flex items-center gap-1 text-[13px] text-muted">
        <span className={btn}>
          <PixelIcon name="heart" size={18} /> {likeCount}
          <span className="sr-only">likes</span>
        </span>
        <Link href={commentsHref} className={btn}>
          <PixelIcon name="comment" size={18} /> {commentCount}
          <span className="sr-only">comments</span>
        </Link>
        <span className={btn}>
          <PixelIcon name="share" size={18} /> {shareCount}
        </span>
        <Link href="/login" className="link ml-auto text-[13px]">
          Sign in to interact
        </Link>
      </div>
    );
  }

  const fd = (extra: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5">
        <button
          type="button"
          className={cn(btn, optimistic.liked && "bg-sunken text-ink")}
          aria-pressed={optimistic.liked}
          disabled={liking}
          onClick={() =>
            startTransition(() => {
              setOptimistic(!optimistic.liked);
              likeAction(fd({ postId }));
            })
          }
        >
          <PixelIcon name="heart" size={18} className={cn(!optimistic.liked && glyphOff)} />
          <span>{optimistic.likeCount}</span>
          <span className="sr-only">{optimistic.liked ? "Unlike" : "Like"}</span>
        </button>
        <Link href={commentsHref} className={btn}>
          <PixelIcon name="comment" size={18} /> {commentCount}
          <span className="sr-only">comments</span>
        </Link>
        <ShareMenu
          count={shareCount}
          busy={sharing}
          onShare={() => startTransition(() => shareAction(fd({ repostOfId: shareTargetId, actingAs: "user", type: "TEXT", body: "" })))}
          onQuote={() => setQuoting(true)}
        />
        <button type="button" className={cn(btn, "ml-auto", saved && "bg-sunken text-ink")} aria-pressed={saved} onClick={() => startTransition(() => saveAction(fd({ postId })))}>
          <PixelIcon name="bookmark" size={18} className={cn(!saved && glyphOff)} />
          <span className="sr-only sm:not-sr-only">{saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      {quoting && (
        <ActionForm action={createPostAction} onSuccess={() => setQuoting(false)} className="mt-2 flex flex-col gap-2 border border-line-strong bg-sunken p-3">
          <input type="hidden" name="repostOfId" value={shareTargetId} />
          <input type="hidden" name="actingAs" value="user" />
          <label htmlFor={`quote-${postId}`} className="text-[13px] font-medium">
            Share with your thoughts
          </label>
          <Textarea id={`quote-${postId}`} name="body" rows={3} maxLength={3000} placeholder="Add a comment…" required autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} onClick={() => setQuoting(false)}>
              Cancel
            </button>
            <SubmitButton size="sm">Share</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

function ShareMenu({ count, busy, onShare, onQuote }: { count: number; busy: boolean; onShare: () => void; onQuote: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className={btn} aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)}>
        <PixelIcon name="share" size={18} /> {count}
        <span className="sr-only">Share options</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1 w-56 border-2 border-line-strong bg-surface py-1 shadow-[3px_3px_0_var(--c-line-strong)]">
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); onShare(); }}>
            Share now
          </button>
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); onQuote(); }}>
            Share with your thoughts…
          </button>
        </div>
      )}
    </div>
  );
}

/** Overflow menu: report or delete. */
export function PostMenu({ postId, canDelete, signedIn, redirectAfterDelete }: { postId: string; canDelete: boolean; signedIn: boolean; redirectAfterDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const toast = useToast();
  const [, del, deleting] = useActionState(async (p: ActionState, f: FormData) => {
    const r = await deletePostAction(p, f);
    if (r && !r.ok) toast(r.message, "error");
    else if (r?.ok && r.message) toast(r.message, "success");
    return r;
  }, null);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!signedIn) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" className="inline-flex size-10 items-center justify-center text-muted hover:bg-sunken hover:text-ink" aria-label="Post options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <PixelIcon name="more" size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 border-2 border-line-strong bg-surface py-1 shadow-[3px_3px_0_var(--c-line-strong)]">
          {canDelete &&
            (confirming ? (
              <button
                role="menuitem"
                type="button"
                disabled={deleting}
                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-danger hover:bg-danger-soft"
                onClick={() => {
                  const f = new FormData();
                  f.append("postId", postId);
                  if (redirectAfterDelete) f.append("redirect", "1");
                  startTransition(() => del(f));
                  setOpen(false);
                }}
              >
                Confirm delete
              </button>
            ) : (
              <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-sunken" onClick={() => setConfirming(true)}>
                Delete post
              </button>
            ))}
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); setReporting(true); }}>
            Report post
          </button>
        </div>
      )}
      {reporting && <ReportDialog targetType="POST" targetId={postId} onClose={() => setReporting(false)} />}
    </div>
  );
}
