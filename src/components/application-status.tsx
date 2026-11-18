import type { ApplicationStatus } from "@/generated/prisma/enums";
import { applicationStatusLabels } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export function statusTone(s: ApplicationStatus) {
  return s === "ACCEPTED" ? "success" : s === "REJECTED" ? "danger" : s === "WITHDRAWN" ? "neutral" : s === "CONTACTED" ? "signal" : "accent";
}

export function StatusTimeline({ events }: { events: { toStatus: ApplicationStatus; createdAt: Date; note?: string | null }[] }) {
  if (events.length <= 1) return null;
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-muted" aria-label="Status history">
      {events.map((e, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>→</span>}
          <span title={e.note ?? undefined}>
            {applicationStatusLabels[e.toStatus]} <span className="font-mono">{formatDate(e.createdAt)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
