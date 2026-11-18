import { Check, Info, X } from "lucide-react";
import type { MatchResult } from "@/lib/matching-engine";
import { matchLabel } from "@/lib/matching-engine";
import { cn } from "./ui/cn";

export function MatchBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-success-soft text-success" : score >= 55 ? "bg-accent-soft text-accent" : "bg-sunken text-ink-2";
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium", tone)} title={`Compatibility score ${score}/100`}>
      <span className="font-mono">{score}</span>
      <span>{matchLabel(score)}</span>
    </span>
  );
}

/** Explains a compatibility score: every factor that contributed (or held it back). */
export function MatchExplainer({ match, title = "Why this matches you" }: { match: MatchResult; title?: string }) {
  return (
    <section aria-label={title} className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <MatchBadge score={match.score} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${match.score}%` }} />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
        {match.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            {r.positive ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />}
            <span className={r.positive ? "text-ink-2" : "text-muted"}>{r.text}</span>
          </li>
        ))}
        {match.reasons.length === 0 && (
          <li className="flex items-start gap-2 text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Add skills and availability to your profile to get better matches.
          </li>
        )}
      </ul>
    </section>
  );
}
