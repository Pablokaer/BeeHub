"use client";

import { useId, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Palette, Trash2, X } from "lucide-react";
import { ART_LANG, AVATAR_ART, COVER_ART, findArt, focalPosition, isCustomArt, type ArtKind } from "@/lib/art-catalog";
import { AvatarStudio } from "./avatar-studio";
import { Avatar, ProfileCover } from "@/components/ui/avatar";
import { UPLOAD_ACCEPT, useImageUpload } from "@/components/ui/image-upload";
import { isPixelPortraitKey } from "@/lib/media";
import { cn } from "@/components/ui/cn";

type Choice = { key: string | null; art: string | null };

const COPY: Record<ArtKind, { label: string; noun: string; empty: string }> = {
  avatar: { label: "Profile picture", noun: "portrait", empty: "No picture: your initials are shown." },
  cover: { label: "Cover", noun: "cover", empty: "No cover: the honeycomb pattern is shown." },
};

/**
 * Profile picture or cover: pick a Colmeia illustration, upload your own image, or remove it.
 * The choice lives in hidden inputs and is saved only with the profile form. The picker dialog
 * keeps the previous selection when cancelled, and focus returns to the button that opened it.
 */
export function ProfileImageField({ kind, personName, initial }: { kind: ArtKind; personName: string; initial: Choice }) {
  const [choice, setChoice] = useState<Choice>(initial);
  const [pending, setPending] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const { upload, busy } = useImageUpload(kind, (key) => setChoice({ key, art: null }));
  const id = useId();
  const catalog = kind === "avatar" ? AVATAR_ART : COVER_ART;
  const copy = COPY[kind];
  const art = findArt(kind, choice.art);
  const seed = personName || "profile";

  const openPicker = () => {
    setPending(choice.art && !isCustomArt(choice.art) ? choice.art : catalog[0]!.id);
    dialog.current?.showModal();
  };
  const closePicker = () => dialog.current?.close();
  const applyPicker = () => {
    if (pending) setChoice({ key: null, art: pending });
    closePicker();
  };

  const summary = art && isCustomArt(art.id) ? (
    "Your custom avatar."
  ) : art ? (
    <>
      Illustration: <span lang={ART_LANG}>{art.label}</span>
    </>
  ) : choice.key ? (
    kind === "avatar" && isPixelPortraitKey(choice.key) ? "Your photo, as a pixel portrait." : "Your uploaded photo."
  ) : (
    copy.empty
  );

  const pendingArt = findArt(kind, pending);
  // The radios point at a form id that does not exist, so the pending choice is never
  // submitted with the profile; only the hidden inputs below are.
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${id}-status`}>
      <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">{copy.label}</legend>

      {/* Previews at the sizes the profile actually uses. */}
      {kind === "avatar" ? (
        <div className="flex items-end gap-3" aria-hidden>
          <Avatar name={seed} imageKey={choice.key} art={choice.art} size="xl" />
          <Avatar name={seed} imageKey={choice.key} art={choice.art} size="lg" />
          <Avatar name={seed} imageKey={choice.key} art={choice.art} size="sm" />
        </div>
      ) : (
        // Same proportions as the profile header (≈ 3.75:1 on desktop) and the feed card (≈ 3.2:1).
        <div className="flex flex-col gap-2" aria-hidden>
          <div>
            <ProfileCover imageKey={choice.key} art={choice.art} seed={seed} className="aspect-[15/4] w-full" />
            <p className="mt-1 text-[11px] text-muted">Profile page</p>
          </div>
          <div className="w-[min(100%,260px)]">
            <ProfileCover imageKey={choice.key} art={choice.art} seed={seed} className="aspect-[16/5] w-full" />
            <p className="mt-1 text-[11px] text-muted">Profile card</p>
          </div>
        </div>
      )}

      <p id={`${id}-status`} ref={status} className="text-[13px] text-ink-2" aria-live="polite">
        {busy ? "Uploading…" : summary}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {kind === "avatar" && <AvatarStudio current={choice.art} onApply={(artId) => setChoice({ key: null, art: artId })} />}
        <button ref={trigger} type="button" className="cm-wax inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-semibold" aria-haspopup="dialog" onClick={openPicker}>
          <Palette className="size-4" aria-hidden /> Choose illustration
        </button>
        <label className="cm-wax inline-flex h-10 cursor-pointer items-center gap-1.5 px-3 text-[13px] font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
          {kind === "avatar" ? (choice.key ? "Replace photo" : "Upload photo") : choice.key ? "Replace upload" : "Upload image"}
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await upload(f);
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
        </label>
        {(choice.key || choice.art) && (
          <button type="button" onClick={() => setChoice({ key: null, art: null })} className="inline-flex h-10 items-center gap-1 px-2 text-[13px] font-semibold text-muted hover:bg-sunken hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden /> Remove
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Uploads: JPEG, PNG, WebP or GIF, up to 5 MB. Metadata is removed. Changes apply when you save the profile.
      </p>

      <input type="hidden" name={`${kind}Key`} value={choice.key ?? ""} />
      <input type="hidden" name={`${kind}Art`} value={choice.art ?? ""} />

      <dialog
        ref={dialog}
        className="cm-dialog w-[min(720px,calc(100%-24px))]"
        aria-labelledby={`${id}-title`}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(e) => {
          // Enter on a choice applies it instead of submitting the surrounding profile form.
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            applyPicker();
          }
        }}
      >
        <div className="cm-dialog-head">
          <h2 id={`${id}-title`}>Choose a {copy.noun}</h2>
          <button type="button" onClick={closePicker} aria-label="Cancel and close" className="grid size-11 place-items-center hover:bg-sunken">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div aria-hidden className="flex justify-center">
            {kind === "avatar" ? (
              <Avatar name={seed} art={pending} size="xl" />
            ) : (
              <ProfileCover art={pending} seed={seed} className="aspect-[15/4] w-full" />
            )}
          </div>
          <div role="radiogroup" aria-label={`${copy.noun[0]!.toUpperCase()}${copy.noun.slice(1)} illustrations`} className={cn("grid gap-2", kind === "avatar" ? "grid-cols-[repeat(auto-fill,minmax(110px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
            {catalog.map((a) => {
              const checked = pending === a.id;
              return (
                <label key={a.id} lang={ART_LANG} className="cm-pick">
                  <input type="radio" name={`${id}-art`} form={`${id}-picker`} value={a.id} checked={checked} onChange={() => setPending(a.id)} className="sr-only" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt={a.alt} width={a.width} height={a.height} loading="lazy" className={cn("cm-pixel w-full object-cover", kind === "avatar" ? "aspect-square" : "aspect-[2.4]")} style={kind === "cover" ? { objectPosition: focalPosition(a) } : undefined} />
                  <span className="flex items-center gap-1">
                    {checked && <Check className="size-3.5 shrink-0" aria-hidden />}
                    {a.label}
                  </span>
                </label>
              );
            })}
          </div>
          {pendingArt && (
            <p className="text-xs text-muted" lang={ART_LANG}>
              {pendingArt.alt}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
            <button type="button" onClick={closePicker} className="cm-wax inline-flex h-11 items-center px-4 text-sm font-semibold">
              Cancel
            </button>
            <button type="button" onClick={applyPicker} disabled={!pending} className="cm-gold inline-flex h-11 items-center px-5 text-sm">
              Use this {copy.noun}
            </button>
          </div>
        </div>
      </dialog>
    </fieldset>
  );
}
