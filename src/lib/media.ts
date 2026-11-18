/** Public URL for a stored media key (served by /api/media/[...key]). */
export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/api/media/${key}` : null;
}

/** Avatar uploads are stored as pixel portraits with this suffix (rendered with crisp pixels). */
export const PIXEL_PORTRAIT_SUFFIX = ".px.webp";

export function isPixelPortraitKey(key: string | null | undefined): boolean {
  return !!key && key.endsWith(PIXEL_PORTRAIT_SUFFIX);
}
