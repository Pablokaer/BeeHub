import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { Viewer } from "@/server/auth/types";
import { listConversations } from "@/server/messaging";
import { timeAgo } from "@/lib/format";
import { truncate } from "@/lib/text";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

export async function ConversationList({ viewer, activeId }: { viewer: Viewer; activeId?: string }) {
  const items = await listConversations(viewer);
  if (items.length === 0) {
    return (
      <EmptyState icon={<MessageSquare />} title="No conversations yet" className="m-3 border-0">
        Start a conversation from someone&apos;s profile, an application or your connections.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line" aria-label="Conversations">
      {items.map((c) => {
        const name = c.other?.status === "ACTIVE" ? c.other.profile?.displayName ?? c.other.username : "Unavailable member";
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              aria-current={c.id === activeId ? "page" : undefined}
              className={cn("flex gap-3 px-4 py-3 hover:bg-sunken", c.id === activeId && "bg-sunken")}
            >
              <Avatar name={name} imageKey={c.other?.profile?.avatarKey} art={c.other?.profile?.avatarArt} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{name}</span>
                  {c.last && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.last.createdAt)}</span>}
                </span>
                <span className={cn("block truncate text-[13px]", c.unread ? "text-ink" : "text-muted")}>
                  {c.last ? `${c.last.senderId === viewer.id ? "You: " : ""}${truncate(c.last.body, 80)}` : "No messages yet"}
                </span>
              </span>
              {c.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-signal" aria-label="Unread" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
