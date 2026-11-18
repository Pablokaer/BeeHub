"use client";

import Link from "next/link";
import { startTransition, useActionState, useCallback, useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { PixelIcon } from "./colmeia/pixel-icon";
import { toggleLikeAction, toggleSaveAction, createPostAction, deletePostAction } from "@/app/actions/social";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton, Textarea } from "./ui/form";
import { ReportDialog } from "./report-dialog";
import { CommentForm } from "./comment-form";
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
  standalone,
  quotePreview,
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
  /** On the post page the full comment thread is already below, so the button focuses its composer. */
  standalone?: boolean;
  /** The original post (byline + content), shown under the message in the "share with your thoughts" dialog. */
  quotePreview?: ReactNode;
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
  const [commenting, setCommenting] = useState(false);
  const inlineFieldId = `c-inline-${postId}`;
  const openComments = () => {
    if (standalone) {
      const field = document.getElementById("c-root");
      if (field) {
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        field.focus({ preventScroll: true });
        return;
      }
    }
    setCommenting((open) => !open);
  };

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
        <button type="button" className={cn(btn, commenting && "bg-sunken text-ink")} aria-expanded={standalone ? undefined : commenting} aria-controls={standalone ? undefined : inlineFieldId} onClick={openComments}>
          <PixelIcon name="comment" size={18} className={cn(!commenting && glyphOff)} /> {commentCount}
          <span className="sr-only">{commenting ? "Close comment box" : "Comment"}</span>
        </button>
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
      {commenting && (
        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
          <CommentForm
            postId={postId}
            fieldId={inlineFieldId}
            autoFocus
            onDone={() => toast("Comment posted.", "success")}
            onCancel={() => setCommenting(false)}
          />
          {commentCount > 0 && (
            <Link href={commentsHref} className="link self-start text-[13px]">
              View all {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </Link>
          )}
        </div>
      )}
      {quoting && <QuoteDialog postId={postId} shareTargetId={shareTargetId} preview={quotePreview} onClose={() => setQuoting(false)} />}
    </div>
  );
}

/**
 * "Share with your thoughts": a modal over a blurred page with the message first and the original
 * post right below it. Native <dialog> gives the focus trap and Escape; focus returns to the trigger.
 */
function QuoteDialog({ postId, shareTargetId, preview, onClose }: { postId: string; shareTargetId: string; preview?: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    returnFocus.current = document.activeElement;
    if (d && !d.open) d.showModal();
    // showModal() focuses the first control (the close button); start in the message instead.
    d?.querySelector("textarea")?.focus();
  }, []);
  const close = () => ref.current?.close();
  const titleId = `quote-title-${postId}`;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="cm-dialog cm-dialog-blur cm-quote-dialog"
      onClose={() => {
        onClose();
        (returnFocus.current as HTMLElement | null)?.focus?.();
      }}
      onClick={(e) => {
        // A click on the backdrop (outside the dialog box) closes it.
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
        }
      }}
    >
      <div className="cm-dialog-head">
        <h2 id={titleId}>Share with your thoughts</h2>
        <button type="button" onClick={close} aria-label="Close" className="grid size-11 place-items-center hover:bg-sunken">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <ActionForm action={createPostAction} onSuccess={close} className="flex min-h-0 flex-col gap-3 p-4">
        <input type="hidden" name="repostOfId" value={shareTargetId} />
        <input type="hidden" name="actingAs" value="user" />
        <label htmlFor={`quote-${postId}`} className="sr-only">
          Your message
        </label>
        <Textarea id={`quote-${postId}`} name="body" rows={4} maxLength={3000} placeholder="What do you think about this? Use @ to mention and # for topics." required />
        {preview && (
          <div className="cm-quote-preview" aria-label="Original post">
            {preview}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn} onClick={close}>
            Cancel
          </button>
          <SubmitButton size="sm" pendingLabel="Posting…">
            Post
          </SubmitButton>
        </div>
      </ActionForm>
    </dialog>
  );
}

/**
 * Posts are isolated panels (`isolation: isolate`), so a dropdown inside one can never rise above the
 * next post or the side columns. The menu is portalled to <body> and placed under its trigger, above
 * everything on the page (the sticky header included).
 */
function useFloatingMenu(open: boolean, close: () => void, width: number) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + window.scrollY + 4, left: left + window.scrollX });
    };
    place();
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        trigger.current?.focus();
      }
    };
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, width]);
  return { trigger, menu, pos };
}

function ShareMenu({ count, busy, onShare, onQuote }: { count: number; busy: boolean; onShare: () => void; onQuote: () => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { trigger, menu, pos } = useFloatingMenu(open, close, 224);
  return (
    <>
      <button ref={trigger} type="button" className={btn} aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)}>
        <PixelIcon name="share" size={18} /> {count}
        <span className="sr-only">Share options</span>
      </button>
      {open && pos && createPortal(
        <div ref={menu} role="menu" style={{ top: pos.top, left: pos.left }} className="absolute z-[100] w-56 border-2 border-line-strong bg-surface py-1 shadow-[3px_3px_0_var(--c-line-strong)]">
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); onShare(); }}>
            Share now
          </button>
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); onQuote(); }}>
            Share with your thoughts…
          </button>
        </div>,
        document.body,
      )}
    </>
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
