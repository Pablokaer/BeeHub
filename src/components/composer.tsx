"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { PixelIcon } from "./colmeia/pixel-icon";
import { cn } from "./ui/cn";
import { postTypeLabels } from "@/lib/constants";
import { mediaUrl } from "@/lib/media";
import { createPostAction } from "@/app/actions/social";
import { ActionForm, Input, SubmitButton, Textarea } from "./ui/form";
import { Avatar } from "./ui/avatar";
import { useToast } from "./ui/toast";

type Identity = { value: string; label: string };

const tool = "inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-2 text-[13px] font-semibold text-muted hover:bg-sunken hover:text-ink aria-pressed:bg-sunken aria-pressed:text-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus";
const field = "h-10 border border-line-strong bg-input px-2 text-[13px] text-ink";
type Suggestion = { handle: string; kind: string; name: string };

/**
 * Post composer: publish as yourself or as a project/organization you manage,
 * pick a post type, attach up to 4 images or a link, @mention people/projects/orgs.
 */
export function Composer({
  viewerName,
  viewerAvatar,
  viewerArt,
  identities,
  defaultActingAs = "user",
  placeholder = "Share an update, ask for help or start a discussion…",
}: {
  viewerName: string;
  viewerAvatar: string | null;
  viewerArt?: string | null;
  identities: Identity[];
  defaultActingAs?: string;
  placeholder?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [body, setBody] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  // @mention autocomplete for the word under the cursor.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    const upto = body.slice(0, el.selectionStart ?? body.length);
    const m = upto.match(/(?:^|\s)@([a-z0-9-]{1,40})$/i);
    if (!m) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/mentions?q=${encodeURIComponent(m[1])}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setSuggestions(d.results ?? []))
        .catch(() => undefined);
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [body]);

  function insertMention(handle: string) {
    const el = textarea.current;
    const pos = el?.selectionStart ?? body.length;
    const before = body.slice(0, pos).replace(/@([a-z0-9-]*)$/i, `@${handle} `);
    setBody(before + body.slice(pos));
    setSuggestions([]);
    el?.focus();
  }

  async function upload(files: FileList) {
    const room = 4 - images.length;
    if (room <= 0) return toast("You can attach up to 4 images.", "error");
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("purpose", "post");
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
        setImages((i) => [...i, data.key]);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-label="Create a post" className="panel px-3.5 pb-2.5 pt-3.5">
      <ActionForm
        action={createPostAction}
        resetOnSuccess
        onSuccess={() => {
          setImages([]);
          setBody("");
          setShowLink(false);
          setExpanded(false);
        }}
        className="flex flex-col gap-2.5"
      >
        <div className="flex gap-3">
          <Avatar name={viewerName} imageKey={viewerAvatar} art={viewerArt} size="md" />
          <div className="relative flex-1">
            <label htmlFor="composer-body" className="sr-only">
              Post text
            </label>
            <Textarea
              ref={textarea}
              id="composer-body"
              name="body"
              rows={expanded ? 4 : 2}
              maxLength={3000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder={placeholder}
              className="resize-y"
            />
            {suggestions.length > 0 && (
              <ul role="listbox" aria-label="Mention suggestions" className="absolute left-0 right-0 top-full z-20 mt-1 border-2 border-line-strong bg-surface py-1 shadow-[3px_3px_0_var(--c-line-strong)]">
                {suggestions.map((s) => (
                  <li key={s.handle}>
                    <button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); insertMention(s.handle); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunken">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted">@{s.handle}</span>
                      <span className="ml-auto text-[11px] text-muted">{s.kind === "user" ? "Person" : s.kind === "org" ? "Organization" : "Project"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {images.length > 0 && (
          <ul className="flex flex-wrap gap-2 sm:pl-[57px]" aria-label="Attached images">
            {images.map((k) => (
              <li key={k} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(k)!} alt="" className="size-20 border border-line-strong object-cover" />
                <button type="button" aria-label="Remove image" onClick={() => setImages((i) => i.filter((x) => x !== k))} className="absolute -right-2 -top-2 grid size-7 place-items-center border border-line-strong bg-surface hover:bg-sunken">
                  <X className="size-3.5" aria-hidden />
                </button>
                <input type="hidden" name="imageKeys" value={k} />
              </li>
            ))}
          </ul>
        )}
        {showLink && (
          <div className="sm:pl-[57px]">
            <label htmlFor="composer-link" className="sr-only">
              Link URL
            </label>
            <Input id="composer-link" name="linkUrl" type="url" placeholder="https://…" />
          </div>
        )}
        {/* Always visible: attach, author and Post. The post type and counter appear while writing. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-line pt-2.5 sm:pl-[57px]">
          <label className={tool}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PixelIcon name="image" size={18} />}
            Image
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" disabled={uploading} onChange={(e) => e.target.files && void upload(e.target.files)} />
          </label>
          <button type="button" onClick={() => setShowLink((s) => !s)} className={tool} aria-pressed={showLink}>
            <PixelIcon name="link" size={18} /> Link
          </button>
          {expanded ? (
            <>
              <label className="sr-only" htmlFor="composer-type">
                Post type
              </label>
              <select id="composer-type" name="type" defaultValue="TEXT" className={field}>
                {Object.entries(postTypeLabels)
                  .filter(([v]) => v !== "OPPORTUNITY")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </>
          ) : (
            <input type="hidden" name="type" value="TEXT" />
          )}
          {identities.length > 1 ? (
            <>
              <label className="sr-only" htmlFor="composer-as">
                Post as
              </label>
              <select id="composer-as" name="actingAs" defaultValue={defaultActingAs} className={cn(field, "max-w-[12rem]")}>
                {identities.map((i) => (
                  <option key={i.value} value={i.value}>
                    As {i.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <input type="hidden" name="actingAs" value={defaultActingAs} />
          )}
          <span className="ml-auto flex items-center gap-2">
            {expanded && <span className="font-mono text-[11px] text-muted">{body.length}/3000</span>}
            <SubmitButton size="sm" disabled={uploading}>
              Post <span aria-hidden="true">▸</span>
            </SubmitButton>
          </span>
        </div>
      </ActionForm>
    </section>
  );
}
