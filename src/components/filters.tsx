import type { ReactNode } from "react";
import { ResponsiveFilters } from "./responsive-filters";
import { SlidersHorizontal } from "lucide-react";

/** GET-form filter panel: works without JavaScript, collapses on small screens. */
export function FilterPanel({ action, children, hidden = {} }: { action: string; children: ReactNode; hidden?: Record<string, string | undefined> }) {
  return (
    <ResponsiveFilters>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4 text-sm font-semibold">
        <SlidersHorizontal className="size-4" aria-hidden /> Filters
      </summary>
      <form action={action} className="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-3">
        {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        {children}
        <div className="flex gap-2">
          <button type="submit" className="cm-gold h-11 flex-1 px-3 text-[13px]">
            Apply filters
          </button>
          <a href={action + (hidden.type ? `?type=${hidden.type}` : "")} className="inline-flex h-10 items-center rounded-lg px-2.5 text-[13px] text-muted hover:bg-sunken hover:text-ink">
            Reset
          </a>
        </div>
      </form>
    </ResponsiveFilters>
  );
}

export function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{legend}</legend>
      <div className="flex flex-col gap-1">{children}</div>
    </fieldset>
  );
}

export function FilterCheck({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer min-h-8 items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-3.5 accent-[var(--c-accent)]" />
      {label}
    </label>
  );
}

export function FilterRadio({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer min-h-8 items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="size-3.5 accent-[var(--c-accent)]" />
      {label}
    </label>
  );
}

export function FilterText({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input id={id} name={name} defaultValue={defaultValue} placeholder={placeholder} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  );
}
