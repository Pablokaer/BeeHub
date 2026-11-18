/** Normalize with the browser URL rules before accepting a local destination. */
export function safeRedirect(raw: unknown, fallback = "/feed"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(raw)) return fallback;
  try {
    const base = "https://redirect.invalid";
    const url = new URL(raw, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
