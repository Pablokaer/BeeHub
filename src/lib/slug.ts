/** Rules for handles shared by users (username), organizations and projects (slug). */
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Paths and words that cannot be claimed as a handle. */
export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "api", "app", "about", "auth", "login", "logout", "signup", "register",
  "settings", "feed", "discover", "opportunities", "network", "messages", "notifications", "projects",
  "project", "orgs", "org", "organizations", "u", "p", "o", "me", "help", "support", "terms", "privacy",
  "moderation", "moderator", "dev", "static", "assets", "uploads", "search", "saved", "applications",
  "new", "edit", "manage", "null", "undefined", "root", "system", "collabhub", "beehub", "everyone", "here",
]);

export function slugify(input: string, maxLength = 40): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle) && !RESERVED_HANDLES.has(handle) && !handle.includes("--");
}

/** Fallback base when a name can't produce a valid handle (non-Latin, too short, reserved). */
export const USERNAME_FALLBACK = "member";

/**
 * Base for a generated username: the slugified display name, at most 30 characters so a
 * "-1234" suffix still fits the 40-character handle limit. Never derived from the email
 * address, which would make part of it public.
 */
export function usernameBase(displayName: string): string {
  const base = slugify(displayName, 30);
  return isValidHandle(base) ? base : USERNAME_FALLBACK;
}
