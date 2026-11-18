"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";

/** Navigation link that marks itself as current for its section. */
export function NavLink({ href, children, badge, variant = "rail", match }: { href: string; children: ReactNode; badge?: number; variant?: "rail"; match?: string }) {
  const pathname = usePathname();
  const prefix = match ?? href;
  const active = pathname === href || pathname.startsWith(prefix + "/") || (prefix !== "/" && pathname.startsWith(prefix));
  const count = badge && badge > 0 ? (badge > 99 ? "99+" : String(badge)) : null;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
    >
      {children}
      {count && (
        <span
          className={cn(variant === "rail" && "cm-nav-badge")}
          aria-label={`${badge} unread`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
