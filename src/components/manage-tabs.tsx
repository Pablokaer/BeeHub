"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui/cn";

/** Sub-navigation for project/organization admin pages. */
export function ManageTabs({ base, items }: { base: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Manage" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {items.map((i) => {
        const href = `${base}${i.href}`;
        const active = i.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px inline-flex h-9 items-center whitespace-nowrap border-b-2 px-2.5 text-sm", active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
