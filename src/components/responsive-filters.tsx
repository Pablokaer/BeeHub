"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Keep results within reach on mobile, with an expanded fallback without JS. */
export function ResponsiveDetails({ children, className }: { children: ReactNode; className?: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => { if (details.current) details.current.open = desktop.matches; };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  return <details ref={details} className={className} open>{children}</details>;
}

export function ResponsiveFilters({ children }: { children: ReactNode }) {
  return <ResponsiveDetails className="panel group">{children}</ResponsiveDetails>;
}
