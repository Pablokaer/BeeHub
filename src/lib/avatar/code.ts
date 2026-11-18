import { AVATAR_FIELDS, DEFAULT_AVATAR, type AvatarConfig } from "./options";

/**
 * A built avatar is stored as a short code: "v1-" followed by two base-36 digits per field in
 * AVATAR_FIELDS order. On profiles it lives in `avatarArt` as "custom:<code>", next to catalog
 * illustration ids, so every place that shows an avatar already knows how to display it.
 */
export const CUSTOM_PREFIX = "custom:";
const VERSION = "v1";
const CODE_RE = new RegExp(`^${VERSION}-[0-9a-z]{${AVATAR_FIELDS.length * 2}}$`);

export function encodeAvatar(c: AvatarConfig): string {
  return `${VERSION}-${AVATAR_FIELDS.map((f) => c[f.key].toString(36).padStart(2, "0")).join("")}`;
}

/** The config for a code, or null when malformed or out of range. */
export function decodeAvatar(code: string): AvatarConfig | null {
  if (!CODE_RE.test(code)) return null;
  const digits = code.slice(VERSION.length + 1);
  const out = { ...DEFAULT_AVATAR };
  for (const [i, f] of AVATAR_FIELDS.entries()) {
    const v = parseInt(digits.slice(i * 2, i * 2 + 2), 36);
    if (!Number.isInteger(v) || v < 0 || v >= f.options.length) return null;
    out[f.key] = v;
  }
  return out;
}

export function isCustomAvatarId(value: string | null | undefined): value is string {
  return !!value && value.startsWith(CUSTOM_PREFIX) && decodeAvatar(value.slice(CUSTOM_PREFIX.length)) !== null;
}

export function customAvatarUrl(code: string): string {
  return `/api/avatars/${code}`;
}

/** Random but sensible avatar (used by "Surprise me"); `rand` is injectable for tests. */
export function randomAvatar(rand: () => number = Math.random): AvatarConfig {
  const pick = (n: number) => Math.floor(rand() * n);
  const out = { ...DEFAULT_AVATAR };
  for (const f of AVATAR_FIELDS) out[f.key] = pick(f.options.length);
  // Keep extras occasional so random avatars stay readable.
  for (const key of ["glasses", "accessory", "jewelry", "hat", "facialHair", "details"] as const) if (rand() < 0.55) out[key] = 0;
  return out;
}
