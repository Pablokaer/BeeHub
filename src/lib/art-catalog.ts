import manifest from "../../public/brand/colmeia/catalogo.json";
import { isPixelPortraitKey, mediaUrl } from "./media";

/**
 * Colmeia illustration catalog: the cover and avatar artworks a member can pick for their
 * profile. The manifest in public/brand/colmeia is the single source of truth; profiles store
 * only the stable `id`, and URLs are resolved here, never taken from user input.
 *
 * Catalog art is deliberately separate from uploaded media (src/lib/media.ts): uploads are
 * private keys served through /api/media with ownership and visibility checks, while catalog
 * art is static, public brand artwork.
 */

export type ArtKind = "avatar" | "cover";

export type ArtEntry = {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Normalized 0–1 coordinates of the subject; covers only. */
  focalPoint?: { x: number; y: number };
};

const PREFIX = "/brand/colmeia/";

/** Language of the manifest's labels and alt texts (Portuguese), for lang attributes. */
export const ART_LANG = "pt";

function load(entries: ArtEntry[]): readonly ArtEntry[] {
  for (const e of entries) {
    // A manifest entry must point inside the brand folder; anything else is a packaging error.
    if (!e.src.startsWith(PREFIX) || e.src.includes("..")) throw new Error(`Invalid catalog path for ${e.id}`);
  }
  return Object.freeze(entries.map((e) => Object.freeze({ ...e })));
}

export const COVER_ART = load(manifest.covers);
export const AVATAR_ART = load(manifest.avatars);

const byKind: Record<ArtKind, readonly ArtEntry[]> = { avatar: AVATAR_ART, cover: COVER_ART };

export const AVATAR_ART_IDS = AVATAR_ART.map((a) => a.id) as [string, ...string[]];
export const COVER_ART_IDS = COVER_ART.map((a) => a.id) as [string, ...string[]];

/** The catalog entry for an id of the given kind, or null (unknown id or wrong kind). */
export function findArt(kind: ArtKind, id: string | null | undefined): ArtEntry | null {
  if (!id) return null;
  return byKind[kind].find((a) => a.id === id) ?? null;
}

export function isArtId(kind: ArtKind, id: string): boolean {
  return findArt(kind, id) !== null;
}

/** CSS object-position for a cover's focal point, e.g. "62% 58%". */
export function focalPosition(art: Pick<ArtEntry, "focalPoint"> | null | undefined): string {
  const f = art?.focalPoint;
  if (!f) return "50% 50%";
  const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 1000) / 10}%`;
  return `${pct(f.x)} ${pct(f.y)}`;
}

/** What to show for a profile image: an uploaded key or a catalog illustration (never both). */
export type ProfileImage = { src: string; alt: string; pixelated: boolean; position: string } | null;

export function resolveProfileImage(kind: ArtKind, source: { key?: string | null; art?: string | null }): ProfileImage {
  const art = findArt(kind, source.art);
  if (art) return { src: art.src, alt: art.alt, pixelated: true, position: kind === "cover" ? focalPosition(art) : "50% 47%" };
  const url = mediaUrl(source.key);
  // Avatar uploads are pixel portraits (crisp scaling); older uploads and covers are photos.
  return url ? { src: url, alt: "", pixelated: isPixelPortraitKey(source.key), position: "50% 50%" } : null;
}
