/**
 * Plain-text content model for posts, comments and messages.
 * User content is never rendered as HTML: it is tokenized into text, links,
 * @mentions and #hashtags, and React renders each token as escaped text or a link.
 */

export type Token =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; href: string }
  | { kind: "mention"; value: string; handle: string }
  | { kind: "hashtag"; value: string; tag: string };

const TOKEN_RE =
  /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|(^|[^\w@])@([a-zA-Z0-9][a-zA-Z0-9_-]{1,38})|(^|[^\w#&])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,39})/gu;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of input.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (m[1]) {
      if (start > last) tokens.push({ kind: "text", value: input.slice(last, start) });
      tokens.push({ kind: "link", value: m[1], href: m[1] });
      last = start + m[0].length;
    } else if (m[3]) {
      const prefix = m[2] ?? "";
      const tokenStart = start + prefix.length;
      if (tokenStart > last) tokens.push({ kind: "text", value: input.slice(last, tokenStart) });
      tokens.push({ kind: "mention", value: `@${m[3]}`, handle: m[3] });
      last = start + m[0].length;
    } else if (m[5]) {
      const prefix = m[4] ?? "";
      const tokenStart = start + prefix.length;
      if (tokenStart > last) tokens.push({ kind: "text", value: input.slice(last, tokenStart) });
      tokens.push({ kind: "hashtag", value: `#${m[5]}`, tag: m[5] });
      last = start + m[0].length;
    }
  }
  if (last < input.length) tokens.push({ kind: "text", value: input.slice(last) });
  return tokens;
}

export function extractMentions(input: string): string[] {
  const set = new Set<string>();
  for (const t of tokenize(input)) if (t.kind === "mention") set.add(t.handle.toLowerCase());
  return [...set].slice(0, 20);
}

export function extractHashtags(input: string): string[] {
  const set = new Set<string>();
  for (const t of tokenize(input)) if (t.kind === "hashtag") set.add(t.tag);
  return [...set].slice(0, 10);
}

/** Only http(s) URLs are ever turned into links. */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + "…";
}
