import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/viewer";
import { listBlocked } from "@/server/social/graph";
import { unblockAction } from "@/app/actions/settings";
import { PersonCard } from "@/components/entity-cards";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Blocked members" };

export default async function BlockedPage() {
  const viewer = await requireViewerPage("/settings/blocked");
  const rows = await listBlocked(viewer);
  if (rows.length === 0) return <EmptyState title="You have not blocked anyone">Blocked members cannot see your profile, message you, connect, follow or interact with your posts.</EmptyState>;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <PersonCard
          key={r.blocked.id}
          user={r.blocked}
          actions={
            <ActionButton action={unblockAction} fields={{ userId: r.blocked.id }}>
              Unblock
            </ActionButton>
          }
        />
      ))}
    </div>
  );
}
