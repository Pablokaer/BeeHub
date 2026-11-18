import { Building2, FolderGit2 } from "lucide-react";
import { initials } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { ART_LANG, resolveProfileImage } from "@/lib/art-catalog";
import { cn } from "./cn";
import { CoverWeave } from "../colmeia/cover-weave";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const LOGO_SIZES: Record<Size, string> = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base", xl: "size-24 text-2xl" };

/** Deterministic warm tint so initials portraits are distinguishable. */
function tint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return { backgroundColor: `hsl(${h} 45% 84%)`, color: `hsl(${h} 45% 22%)` };
}

/**
 * Member portrait in the Colmeia honeycomb frame (honey and cocoa ring). Shows a catalog
 * illustration (pixel-sharp), an uploaded photo (normal rendering) or initials.
 * Decorative: the surrounding link or text carries the person's name.
 */
export function Avatar({ name, imageKey, art, size = "md", className }: { name: string; imageKey?: string | null; art?: string | null; size?: Size; className?: string }) {
  const image = resolveProfileImage("avatar", { key: imageKey, art });
  return (
    <span className={cn("cm-hex", `cm-hex-${size}`, className)} aria-hidden>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt="" loading="lazy" decoding="async" className={cn(image.pixelated && "cm-pixel")} style={{ objectPosition: image.position }} />
      ) : (
        <span className="cm-hex-initials" style={tint(name)}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}

/**
 * Panoramic profile cover: catalog art (focal point respected, pixel-sharp), an uploaded
 * image, or the honeycomb weave fallback when the member has not chosen one.
 */
export function ProfileCover({ imageKey, art, seed, className, alt = false }: { imageKey?: string | null; art?: string | null; seed: string; className?: string; alt?: boolean }) {
  const image = resolveProfileImage("cover", { key: imageKey, art });
  const tone = [...seed].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3;
  return (
    <div className={cn("cm-cover", className)} lang={image?.pixelated && alt ? ART_LANG : undefined}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={alt ? image.alt : ""} decoding="async" className={cn(image.pixelated && "cm-pixel")} style={{ objectPosition: image.position }} />
      ) : (
        <CoverWeave tone={tone} />
      )}
    </div>
  );
}

/** Stepped square logo for organizations and projects. */
export function EntityLogo({ name, imageKey, kind, size = "md", className }: { name: string; imageKey?: string | null; kind: "org" | "project"; size?: Size; className?: string }) {
  const url = mediaUrl(imageKey);
  const Icon = kind === "org" ? Building2 : FolderGit2;
  return (
    <span className={cn("cm-logo font-semibold", LOGO_SIZES[size], className)} aria-hidden>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        <span style={tint(name)}>{size === "xs" || size === "sm" ? <Icon className="size-1/2" /> : initials(name)}</span>
      )}
    </span>
  );
}
