"use client";

import Link from "next/link";
import { useRef } from "react";
import { X } from "lucide-react";
import { PixelIcon } from "../colmeia/pixel-icon";

/**
 * "Meet Bia" opens a small modal about the mascot. Native <dialog>: Escape and the close
 * button dismiss it, and focus returns to the trigger.
 */
export function MeetBia() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    dialog.current?.close();
  };
  return (
    <>
      <button ref={trigger} type="button" className="cm-queen" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <PixelIcon name="crown" size={18} /> Meet Bia, our queen bee
      </button>
      <dialog ref={dialog} className="cm-dialog" aria-labelledby="meet-bia-title" onClose={() => trigger.current?.focus()}>
        <div className="cm-dialog-head">
          <h2 id="meet-bia-title">Bia</h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-11 place-items-center hover:bg-sunken">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4 text-sm">
          <div className="relative inline-block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/bia-logo-v2.png" alt="Bia, the BeeHub bee" width={106} height={106} className="cm-pixel object-contain" />
            <span className="absolute right-0 top-0 rotate-12">
              <PixelIcon name="crown" size={27} />
            </span>
          </div>
          <p>Bia is the BeeHub mascot. Like a hive, the community works best when people bring different skills to the same project.</p>
          <p>Start from your feed to follow your projects, or explore opportunities to find where you can help.</p>
          <Link href="/opportunities" onClick={close} className="link inline-flex min-h-11 items-center font-semibold">
            Explore opportunities →
          </Link>
        </div>
      </dialog>
    </>
  );
}
