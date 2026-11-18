/** Public URL for a stored media key (served by /api/media/[...key]). */
export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/api/media/${key}` : null;
}

/**
 * Profile photos uploaded while the pixel-portrait filter existed (now removed) end with this
 * suffix; they are still rendered with crisp pixels.
 */
export const PIXEL_PORTRAIT_SUFFIX = ".px.webp";

export function isPixelPortraitKey(key: string | null | undefined): boolean {
  return !!key && key.endsWith(PIXEL_PORTRAIT_SUFFIX);
}
