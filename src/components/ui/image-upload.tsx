"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { mediaUrl } from "@/lib/media";
import { useToast } from "./toast";
import { cn } from "./cn";

type UploadPurpose = "avatar" | "cover" | "logo" | "gallery" | "post";

/**
 * Uploads a file to /api/uploads (validated and re-encoded server-side) and reports the new
 * media key. Ownership is checked again when a form saves the key.
 */
export function useImageUpload(purpose: UploadPurpose, onUploaded: (key: string) => void) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", purpose);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
      onUploaded(data.key);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }
  return { upload, busy };
}

export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Uploads an image and stores the returned media key in a hidden input, so the surrounding
 * form saves it.
 */
export function ImageUpload({
  name,
  label,
  purpose,
  defaultKey,
  shape = "square",
}: {
  name: string;
  label: string;
  purpose: UploadPurpose;
  defaultKey?: string | null;
  shape?: "square" | "round" | "wide";
}) {
  const [key, setKey] = useState<string | null>(defaultKey ?? null);
  const input = useRef<HTMLInputElement>(null);
  const { upload: send, busy } = useImageUpload(purpose, setKey);
  const upload = async (file: File) => {
    await send(file);
    if (input.current) input.current.value = "";
  };

  const url = mediaUrl(key);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-sunken text-muted",
            shape === "round" && "size-16 rounded-full",
            shape === "square" && "size-16 rounded-lg",
            shape === "wide" && "h-16 w-48 rounded-lg",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" aria-hidden />}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium hover:bg-sunken focus-within:ring-2 focus-within:ring-accent/40">
            {key ? "Replace" : "Upload"}
            <input
              ref={input}
              type="file"
              accept={UPLOAD_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </label>
          {key && (
            <button type="button" onClick={() => setKey(null)} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-sunken hover:text-danger">
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </button>
          )}
        </div>
      </div>
      <input type="hidden" name={name} value={key ?? ""} />
      <p className="text-xs text-muted">JPEG, PNG, WebP or GIF, up to 5 MB. Metadata is removed.</p>
    </div>
  );
}
