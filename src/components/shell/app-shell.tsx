import Link from "next/link";
import { getViewer } from "@/server/auth/viewer";
import { unreadNotificationCount } from "@/server/notifications";
import { unreadConversationCount } from "@/server/messaging";
import { isStaff } from "@/server/auth/types";
import { env } from "@/server/env";
import { siteConfig } from "@/lib/constants";
import { ButtonLink } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { PixelIcon, type PixelIconName } from "../colmeia/pixel-icon";
import { HiveYard } from "../colmeia/hive-yard";
import { resendVerificationAction } from "@/app/actions/auth";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { MeetBia } from "./meet-bia";

/** Bia with the pixel wordmark: the Colmeia header identity. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="cm-wordmark" aria-label={`${siteConfig.name} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/bia-logo-v2.png" width={42} height={42} alt="" aria-hidden="true" />
      <span aria-hidden="true">
        Bee<b>Hub</b>
      </span>
      <i className="cm-logo-cell" aria-hidden="true" />
    </Link>
  );
}

function SearchBox() {
  return (
    <form action="/discover" role="search" className="cm-search" aria-label={`Search ${siteConfig.name}`}>
      <label htmlFor="global-search" className="sr-only">
        Search people, projects, organizations and opportunities
      </label>
      <PixelIcon name="search" size={17} />
      <input id="global-search" name="q" type="search" placeholder="Search the hive…" autoComplete="off" />
      <button type="submit">Search</button>
    </form>
  );
}

function Drips() {
  return (
    <div className="cm-drips" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

/** Top bar. Reads the session, so it renders inside a Suspense boundary. */
export async function TopBar() {
  const viewer = await getViewer();
  const notifications = viewer ? await unreadNotificationCount(viewer.id) : 0;

  return (
    <>
      <header className="cm-header">
        <div className="cm-header-inner">
          <Wordmark href={viewer ? "/feed" : "/"} />
          <SearchBox />
          <div className="cm-header-actions">
            <ThemeToggle />
            {viewer ? (
              <>
                <Link href="/notifications" className="cm-header-button" aria-label={notifications ? `Notifications, ${notifications} unread` : "Notifications"}>
                  <PixelIcon name="bell" size={25} />
                  {notifications > 0 && (
                    <span className="cm-header-badge" aria-hidden="true">
                      {notifications > 99 ? "99+" : notifications}
                    </span>
                  )}
                </Link>
                <UserMenu
                  name={viewer.displayName}
                  username={viewer.username}
                  avatarKey={viewer.avatarKey}
                  avatarArt={viewer.avatarArt}
                  items={[
                    [
                      { href: `/u/${viewer.username}`, label: "View profile" },
                      { href: "/profile/edit", label: "Edit profile" },
                    ],
                    [
                      { href: "/my-projects", label: "My projects & organizations" },
                      { href: "/opportunities/manage", label: "My opportunities" },
                      { href: "/applications", label: "My applications" },
                      { href: "/applications/received", label: "Received applications" },
                      { href: "/saved", label: "Saved posts" },
                    ],
                    [
                      { href: "/analytics", label: "Your analytics" },
                      { href: "/settings", label: "Settings" },
                      ...(isStaff(viewer) ? [{ href: "/moderation", label: "Moderation" }] : []),
                    ],
                  ]}
                />
              </>
            ) : (
              <>
                <Link href="/login" className="cm-header-button">
                  Sign in
                </Link>
                <ButtonLink href="/signup" size="sm" className="min-h-10">
                  Join
                </ButtonLink>
              </>
            )}
          </div>
        </div>
        <Drips />
      </header>
      {viewer && !viewer.emailVerified && (
        <div className="cm-verify">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 pt-4 text-[13px]">
            <span>
              Confirm <strong>{viewer.email}</strong> to publish, apply, connect and message.
            </span>
            <ActionButton action={resendVerificationAction} variant="ghost" size="sm" className="h-7 text-warn">
              Resend link
            </ActionButton>
            {env().NODE_ENV !== "production" && (
              <Link href="/dev/mailbox" className="underline underline-offset-2">
                Open dev mailbox
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

type RailItem = { href: string; label: string; icon: PixelIconName; badge?: number; match?: string };

/** Navigation rail beside the content (tablet and desktop), with the apiary and Bia. */
export async function SideRail() {
  const viewer = await getViewer();
  const messages = viewer ? await unreadConversationCount(viewer.id) : 0;
  const items: RailItem[] = [
    ...(viewer ? [{ href: "/feed", label: "Feed", icon: "house" as const }] : []),
    { href: "/discover", label: "Discover", icon: "compass" },
    { href: "/opportunities", label: "Opportunities", icon: "briefcase" },
    ...(viewer
      ? [
          { href: "/network", label: "My network", icon: "users" as const },
          { href: "/messages", label: "Messages", icon: "envelope" as const, badge: messages },
          { href: "/saved", label: "Saved", icon: "bookmark" as const },
        ]
      : []),
  ];
  return (
    <aside className="cm-rail" aria-label="Sections">
      <div className="panel cm-rail-inner">
        <nav className="cm-nav" aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} variant="rail" badge={i.badge} match={i.match}>
              <PixelIcon name={i.icon} size={24} />
              <span>{i.label}</span>
            </NavLink>
          ))}
          {!viewer && (
            <p className="px-2 pt-3 text-[13px] text-muted">
              <Link href="/login" className="link font-semibold">
                Sign in
              </Link>{" "}
              to see your feed, network and messages.
            </p>
          )}
        </nav>
        <div className="cm-apiary" aria-hidden="true">
          <div className="cm-comb">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bia-logo-v2.png" alt="" className="cm-fly" width={36} height={36} />
          <HiveYard className="cm-yard" />
        </div>
        <MeetBia />
      </div>
    </aside>
  );
}

export function SideRailSkeleton() {
  return (
    <aside className="cm-rail" aria-hidden="true">
      <div className="panel cm-rail-inner" />
    </aside>
  );
}

export function TopBarSkeleton() {
  return (
    <header className="cm-header">
      <div className="cm-header-inner" aria-hidden="true">
        <Wordmark />
        <div className="cm-search h-[44px]" />
        <div />
      </div>
      <Drips />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-16 w-[min(100%-24px,1480px)] border-t border-line-strong px-1 py-6 text-xs text-muted">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <span>{siteConfig.name}</span>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/discover" className="hover:text-ink">
          Discover
        </Link>
        <Link href="/opportunities" className="hover:text-ink">
          Opportunities
        </Link>
      </div>
    </footer>
  );
}
