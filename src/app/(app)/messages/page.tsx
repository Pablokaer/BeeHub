import type { Metadata } from "next";
import { Suspense } from "react";
import { requireViewerPage } from "@/server/auth/viewer";
import { ListSkeleton, PageHeader } from "@/components/ui/misc";
import { ConversationList } from "./conversation-list";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await requireViewerPage("/messages");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Messages" />
      <div className="panel grid min-h-[60vh] overflow-hidden md:grid-cols-[320px_1fr]">
        <div className="border-line md:border-r">
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ConversationList viewer={viewer} />
          </Suspense>
        </div>
        <div className="hidden items-center justify-center p-8 text-sm text-muted md:flex">Select a conversation to read it.</div>
      </div>
    </div>
  );
}
