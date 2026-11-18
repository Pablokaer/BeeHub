import Link from "next/link";
import { tokenize } from "@/lib/text";
import { tagSlug } from "@/lib/tags";
import { cn } from "./ui/cn";

export type MentionRef = { handle: string; userId: string | null; organizationId: string | null; projectId: string | null };

/**
 * Renders user-written text safely: tokens become escaped text or links. @mentions are
 * linked only when they were resolved at write time (stored Mention rows).
 */
export function RichText({ text, mentions = [], className }: { text: string; mentions?: MentionRef[]; className?: string }) {
  const known = new Map(mentions.map((m) => [m.handle.toLowerCase(), m]));
  return (
    <div className={cn("prose-plain", className)}>
      {tokenize(text).map((t, i) => {
        if (t.kind === "text") return <span key={i}>{t.value}</span>;
        if (t.kind === "link")
          return (
            <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="link break-all">
              {t.value}
            </a>
          );
        if (t.kind === "hashtag")
          return (
            <Link key={i} href={`/tags/${tagSlug(t.tag)}`} className="link">
              {t.value}
            </Link>
          );
        const m = known.get(t.handle.toLowerCase());
        if (!m) return <span key={i}>{t.value}</span>;
        const href = m.userId ? `/u/${m.handle}` : m.organizationId ? `/o/${m.handle}` : `/p/${m.handle}`;
        return (
          <Link key={i} href={href} className="font-medium text-accent hover:underline">
            {t.value}
          </Link>
        );
      })}
    </div>
  );
}
