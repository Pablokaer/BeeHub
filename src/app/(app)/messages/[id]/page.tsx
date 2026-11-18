import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { getConversation } from "@/server/messaging";
import { isAppError } from "@/server/errors";
import { Avatar } from "@/components/ui/avatar";
import { ListSkeleton } from "@/components/ui/misc";
import { ConversationList } from "../conversation-list";
import { Thread } from "./thread";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const viewer = await requireViewerPage(`/messages/${id}`);
  const conv = await getConversation(viewer, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!conv) notFound();
  const name = conv.other.status === "ACTIVE" ? conv.other.profile?.displayName ?? conv.other.username : "Unavailable member";
  return (
    <div className="mx-auto max-w-5xl">
      <div className="panel grid h-[calc(100dvh-170px)] min-h-[420px] overflow-hidden md:grid-cols-[320px_1fr]">
        <div className="hidden overflow-y-auto border-r border-line md:block">
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ConversationList viewer={viewer} activeId={id} />
          </Suspense>
        </div>
        <section className="flex min-h-0 flex-col" aria-label={`Conversation with ${name}`}>
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Link href="/messages" className="md:hidden" aria-label="Back to conversations">
              <ArrowLeft className="size-5" />
            </Link>
            <Avatar name={name} imageKey={conv.other.profile?.avatarKey} art={conv.other.profile?.avatarArt} size="sm" />
            <div className="min-w-0">
              {conv.other.status === "ACTIVE" ? (
                <Link href={`/u/${conv.other.username}`} className="block truncate text-sm font-semibold hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="text-sm font-semibold">{name}</span>
              )}
              {conv.other.profile?.headline && <p className="truncate text-xs text-muted">{conv.other.profile.headline}</p>}
            </div>
          </header>
          <Thread
            conversationId={conv.id}
            viewerId={viewer.id}
            otherName={name}
            canSend={conv.canSend && viewer.emailVerified}
            otherLastReadAt={conv.otherLastReadAt?.toISOString() ?? null}
            initial={conv.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          />
        </section>
      </div>
    </div>
  );
}
