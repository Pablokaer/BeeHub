import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "signal" | "success" | "danger" | "warn"; className?: string }) {
  const tones = {
    neutral: "bg-sunken text-ink-2",
    accent: "bg-accent-soft text-accent",
    signal: "bg-signal-soft text-signal",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
  };
  return <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11.5px] font-medium", tones[tone], className)}>{children}</span>;
}

export function TagChip({ slug, name, href, active }: { slug: string; name: string; href?: string; active?: boolean }) {
  return (
    <Link
      href={href ?? `/tags/${slug}`}
      className={cn(
        "inline-flex h-6 items-center rounded-sm border border-transparent bg-sunken px-2 text-[12px] transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-transparent bg-sunken text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {name}
    </Link>
  );
}

export function TagList({ tags, max = 8, className }: { tags: { slug: string; name: string }[]; max?: number; className?: string }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((t) => (
        <TagChip key={t.slug} {...t} />
      ))}
      {tags.length > max && <span className="inline-flex h-6 items-center px-1 text-[12px] text-muted">+{tags.length - max}</span>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("panel flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 text-muted [&_svg]:size-6">{icon}</div>}
      <p className="font-bold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2.5">
      <div className="panel cm-stream-title">
        <div className="min-w-0">
          <h1>{title}</h1>
          {eyebrow && <div className="mt-1 text-[13px] text-[#f3d9a5]">{eyebrow}</div>}
        </div>
        <div className="cm-comb cm-comb-heading" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      {(description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-1">
          {description ? <p className="max-w-2xl text-sm text-ink-2">{description}</p> : <span />}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 id={id} className="text-[15px] font-semibold text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside"; "aria-labelledby"?: string }) {
  return (
    <As className={cn("panel p-4", className)} {...rest}>
      {children}
    </As>
  );
}

export function Tabs({ items, label }: { items: { href: string; label: ReactNode; active?: boolean; count?: number }[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 mb-1 flex gap-2 overflow-x-auto border-b border-line px-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-sm font-semibold transition-colors",
            t.active ? "border-line-strong text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {typeof t.count === "number" && t.count > 0 && <span className="rounded bg-sunken px-1.5 font-mono text-[11px] text-ink-2">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Page links that preserve the current query string. */
export function Pagination({ page, pageCount, baseHref, params }: { page: number; pageCount: number; baseHref: string; params: Record<string, string | string[] | undefined> }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) if (x) sp.append(k, x);
    }
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${baseHref}?${s}` : baseHref;
  };
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-2 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 hover:bg-sunken" rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 hover:bg-sunken" rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const inner = (
    <>
      <span className="font-semibold text-ink">{value}</span> <span className="text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="text-sm hover:underline">
      {inner}
    </Link>
  ) : (
    <span className="text-sm">{inner}</span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel flex gap-3 p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  const shown = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {shown.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-muted">{i.label}</dt>
          <dd className="text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
