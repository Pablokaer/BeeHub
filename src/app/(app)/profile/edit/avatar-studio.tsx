"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Shuffle, Sparkles, X } from "lucide-react";
import { AVATAR_FIELDS, DEFAULT_AVATAR, type AvatarConfig, type AvatarFieldKey, type ColorOption } from "@/lib/avatar/options";
import { CUSTOM_PREFIX, decodeAvatar, encodeAvatar, randomAvatar } from "@/lib/avatar/code";
import { avatarSvg } from "@/lib/avatar/render";
import { cn } from "@/components/ui/cn";

const TABS: { id: string; label: string; fields: AvatarFieldKey[] }[] = [
  { id: "face", label: "Face", fields: ["skin", "face", "eyes", "eyeColor", "brows", "nose", "mouth", "details"] },
  { id: "hair", label: "Hair", fields: ["hair", "hairColor", "facialHair"] },
  { id: "outfit", label: "Outfit", fields: ["clothing", "clothingColor"] },
  { id: "extras", label: "Extras", fields: ["glasses", "accessory", "jewelry", "hat"] },
  { id: "background", label: "Background", fields: ["background"] },
];

const svgCache = new Map<string, string>();
/** Data URI for a config (memoized: thumbnails re-render often while browsing). */
function preview(c: AvatarConfig): string {
  const code = encodeAvatar(c);
  let uri = svgCache.get(code);
  if (!uri) {
    uri = `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(c))}`;
    if (svgCache.size > 600) svgCache.clear();
    svgCache.set(code, uri);
  }
  return uri;
}

const isColor = (o: object): o is ColorOption => "color" in o;

/**
 * Avatar builder: compose a pixel portrait in the BeeHub style from faces, skin tones, hair,
 * eyes, noses, mouths, beards, clothing, glasses, accessories, jewelry, hats and backgrounds.
 * The result is an avatar id ("custom:<code>") applied to the profile form on confirm.
 */
export function AvatarStudio({ current, onApply }: { current: string | null; onApply: (artId: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [tab, setTab] = useState(TABS[0]!.id);
  const [announce, setAnnounce] = useState("");
  const fields = useMemo(() => TABS.find((t) => t.id === tab)!.fields.map((k) => AVATAR_FIELDS.find((f) => f.key === k)!), [tab]);

  const open = () => {
    const existing = current?.startsWith(CUSTOM_PREFIX) ? decodeAvatar(current.slice(CUSTOM_PREFIX.length)) : null;
    setConfig(existing ?? randomAvatar());
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const apply = () => {
    onApply(CUSTOM_PREFIX + encodeAvatar(config));
    close();
  };

  return (
    <>
      <button ref={trigger} type="button" className="cm-gold inline-flex h-10 items-center gap-1.5 px-3 text-[13px]" aria-haspopup="dialog" onClick={open}>
        <Sparkles className="size-4" aria-hidden /> Create your avatar
      </button>
      <dialog
        ref={dialog}
        className="cm-dialog w-[min(980px,calc(100%-24px))]"
        aria-labelledby={`${uid}-title`}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(e) => {
          // Enter on an option applies the avatar instead of submitting the profile form.
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            apply();
          }
        }}
      >
        <div className="cm-dialog-head">
          <h2 id={`${uid}-title`}>Create your avatar</h2>
          <button type="button" onClick={close} aria-label="Cancel and close" className="grid size-11 place-items-center hover:bg-sunken">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 md:sticky md:top-0 md:self-start">
            <span className="cm-hex" style={{ width: 200, height: 187, ["--cm-ring" as string]: "18px" }} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview(config)} alt="" className="cm-pixel" />
            </span>
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>
            <button
              type="button"
              onClick={() => {
                setConfig(randomAvatar());
                setAnnounce("New random avatar");
              }} className="cm-wax inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-semibold">
              <Shuffle className="size-4" aria-hidden /> Surprise me
            </button>
          </div>
          <div className="min-w-0">
            <div className="cm-tabs !mt-0 !justify-start" role="group" aria-label="Avatar parts">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className="cm-tab-button">
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex max-h-[min(60vh,560px)] flex-col gap-4 overflow-y-auto pr-1">
              {fields.map((f) => (
                <fieldset key={f.key} className="min-w-0">
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">
                    {f.label} <span className="font-normal text-muted">· {f.options[config[f.key]]!.label}</span>
                  </legend>
                  <div className={cn("grid gap-1.5", isColor(f.options[0]!) ? "grid-cols-[repeat(auto-fill,minmax(44px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(76px,1fr))]")}>
                    {f.options.map((opt, i) => {
                      const checked = config[f.key] === i;
                      return (
                        <label key={opt.id} className={cn("cm-pick", isColor(opt) ? "!p-1" : "!gap-1 !p-1 text-[11.5px] leading-tight")} title={opt.label}>
                          <input
                            type="radio"
                            className="sr-only"
                            name={`${uid}-${f.key}`}
                            form={`${uid}-none`}
                            checked={checked}
                            onChange={() => {
                              setConfig((c) => ({ ...c, [f.key]: i }));
                              setAnnounce(`${f.label}: ${opt.label}`);
                            }}
                            aria-label={opt.label}
                          />
                          {isColor(opt) ? (
                            <span className="block h-9 w-full border border-[#3a2216]/40" style={{ background: opt.color }} aria-hidden />
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={preview({ ...config, [f.key]: i })} alt="" className="cm-pixel aspect-square w-full" loading="lazy" />
                              <span className="truncate text-center" aria-hidden>
                                {opt.label}
                              </span>
                            </>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
          <button type="button" onClick={close} className="cm-wax inline-flex h-11 items-center px-4 text-sm font-semibold">
            Cancel
          </button>
          <button type="button" onClick={apply} className="cm-gold inline-flex h-11 items-center px-5 text-sm">
            Use this avatar
          </button>
        </div>
      </dialog>
    </>
  );
}
