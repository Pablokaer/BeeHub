"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

// In-app history for this tab: client-side navigations don't update document.referrer.
let current: string | null = null;
let previous: string | null = null;

/** Mounted once in the app layout; remembers the previous in-app path. */
export function NavigationMemory() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== current) {
      previous = current;
      current = pathname;
    }
  }, [pathname]);
  return null;
}

function cameFromInsideApp() {
  if (previous) return true;
  try {
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1;
  } catch {
    return false;
  }
}

/**
 * Back over a profile cover. Returns to the previous page when the visitor came from inside
 * BeeHub; otherwise (opened directly, from another site or a new tab) it goes to
 * `fallback`, which is also the link target without JavaScript.
 */
export function BackLink({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      onClick={(e) => {
        if (cameFromInsideApp()) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <ArrowLeft className="size-4" aria-hidden /> Back
    </Link>
  );
}
