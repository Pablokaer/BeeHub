"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../ui/avatar";
import { logoutAction } from "@/app/actions/auth";

type Item = { href: string; label: string };

/** Account menu: keyboard accessible (Escape closes, focus returns to the trigger). */
export function UserMenu({ name, username, avatarKey, avatarArt, items }: { name: string; username: string; avatarKey: string | null; avatarArt: string | null; items: Item[][] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="cm-header-button px-1"
      >
        <Avatar name={name} imageKey={avatarKey} art={avatarArt} size="sm" />
        <span className="sr-only">Account menu for {name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-60 border-2 border-line-strong bg-surface py-1.5 text-ink shadow-[4px_4px_0_var(--c-header)]">
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate font-mono text-xs text-muted">@{username}</p>
          </div>
          {items.map((group, gi) => (
            <div key={gi} className="border-b border-line py-1 last:border-0">
              {group.map((i) => (
                <Link key={i.href} role="menuitem" href={i.href} onClick={() => setOpen(false)} className="block px-3 py-1.5 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
          <form action={logoutAction} className="pt-1">
            <button role="menuitem" type="submit" className="block w-full px-3 py-1.5 text-left text-sm text-ink-2 hover:bg-sunken hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
