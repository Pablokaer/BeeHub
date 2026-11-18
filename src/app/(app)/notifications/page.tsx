import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listNotifications } from "@/server/notifications";
import { timeAgo } from "@/lib/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/social";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { NotificationLink } from "./notification-link";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const sp = await searchParams;
  const viewer = await requireViewerPage("/notifications");
  const unreadOnly = sp.filter === "unread";
  const { items } = await listNotifications(viewer, { take: 60, unreadOnly });
  const hasUnread = items.some((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          hasUnread && (
            <ActionButton action={markAllNotificationsReadAction} size="sm">
              Mark all as read
            </ActionButton>
          )
        }
      />
      <Tabs label="Filter" items={[{ href: "/notifications", label: "All", active: !unreadOnly }, { href: "/notifications?filter=unread", label: "Unread", active: unreadOnly }]} />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title={unreadOnly ? "You're all caught up" : "No notifications yet"}>
          Connection requests, comments, mentions, application updates and matching opportunities will show up here.
        </EmptyState>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {items.map((n) => {
            const name = n.actor?.profile?.displayName ?? "BeeHub";
            return (
              <li key={n.id} className={n.readAt ? "" : "bg-accent-soft/40"}>
                <NotificationLink action={markNotificationReadAction} id={n.id} href={n.href} unread={!n.readAt}>
                  <Avatar name={name} imageKey={n.actor?.profile?.avatarKey} art={n.actor?.profile?.avatarArt} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{n.text}</span>
                    <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-signal" aria-label="Unread" />}
                </NotificationLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
