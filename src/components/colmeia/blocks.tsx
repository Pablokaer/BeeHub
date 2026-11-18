import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";
import { PixelIcon, type PixelIconName } from "./pixel-icon";

/** Rail module: framed panel with a dark pixel title strip and an optional "see all" link. */
export function Module({
  id,
  title,
  icon,
  more,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: PixelIconName;
  more?: { href: string; label: string; rel?: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel cm-module", className)} aria-labelledby={id}>
      <div className="cm-module-title">
        <PixelIcon name={icon} size={20} />
        <h2 id={id}>{title}</h2>
      </div>
      <div className="px-1">{children}</div>
      {more && (
        <Link href={more.href} rel={more.rel} className="cm-module-more">
          {more.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

export type Metric = { label: string; value: number; href?: string; hint?: string };

/** Network counters in a stepped strip; each one opens its list when a link is given. */
export function Metrics({ items, className }: { items: Metric[]; className?: string }) {
  return (
    <div className={cn("cm-metrics", className)} style={{ ["--cm-metric-count" as string]: items.length }}>
      {items.map((m) =>
        m.href ? (
          <Link key={m.label} href={m.href} aria-label={`${m.value} ${m.label}${m.hint ? `, ${m.hint}` : ""}`}>
            <span className="cm-metric-number" aria-hidden="true">
              {m.value}
            </span>
            <span className="cm-metric-label" aria-hidden="true">
              {m.label}
            </span>
          </Link>
        ) : (
          <div key={m.label}>
            <span className="cm-metric-number">{m.value}</span>
            <span className="cm-metric-label">{m.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

/** Dark heading strip with honeycomb corner, used at the top of the main column. */
export function StreamTitle({ title, children, as: As = "h1", id }: { title: ReactNode; children?: ReactNode; as?: "h1" | "h2"; id?: string }) {
  return (
    <div className="panel cm-stream-title">
      <div className="min-w-0">
        <As id={id}>{title}</As>
        {children}
      </div>
      <Comb className="cm-comb-heading" count={4} />
    </div>
  );
}

export function Comb({ className, count = 5 }: { className?: string; count?: number }) {
  return (
    <div className={cn("cm-comb", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
