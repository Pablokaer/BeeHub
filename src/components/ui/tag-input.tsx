"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { tagDisplayName, tagSlug } from "@/lib/tags";
import { availablePresets } from "@/lib/profile-presets";
import { useFieldError } from "./form";
import { cn } from "./cn";

type Suggestion = { slug: string; name: string; usageCount: number };

/** Presets shown before "Show all". */
const PRESETS_COLLAPSED = 12;

/**
 * Tag picker with server-side suggestions (/api/tags). Values are posted as repeated
 * hidden inputs named `name`; the server normalizes them again. Optional `presets` render
 * as clickable chips under the field, so several values can be added with one click each.
 */
export function TagInput({
  name,
  label,
  defaultValue = [],
  max = 20,
  placeholder = "Type and press Enter",
  hint,
  suggest = true,
  presets = [],
  presetsLabel = "Suggestions",
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  max?: number;
  placeholder?: string;
  hint?: string;
  /** Fetch suggestions from the shared tag vocabulary (off for free-form lists like languages). */
  suggest?: boolean;
  /** Quick picks shown as chips under the field (already chosen ones are hidden). */
  presets?: readonly string[];
  presetsLabel?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const id = useId();
  const listId = `${id}-list`;
  const error = useFieldError(name);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const focusPresetAt = useRef<number | null>(null);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const keyOf = suggest ? tagSlug : (v: string) => v.trim().toLowerCase();
  const remainingPresets = availablePresets(presets, tags, keyOf);
  const visiblePresets = showAllPresets ? remainingPresets : remainingPresets.slice(0, PRESETS_COLLAPSED);

  // After a chip is clicked it disappears; keep keyboard focus on the chip that took its place.
  useEffect(() => {
    const index = focusPresetAt.current;
    if (index === null) return;
    focusPresetAt.current = null;
    const chips = presetsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-preset]");
    const next = chips?.[Math.min(index, chips.length - 1)];
    (next ?? inputRef.current)?.focus();
  }, [tags]);

  useEffect(() => {
    if (!open || !suggest) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`, { signal: abort.current.signal });
        if (res.ok) {
          const data = (await res.json()) as { tags: Suggestion[] };
          const chosen = new Set(tags.map(tagSlug));
          setSuggestions(data.tags.filter((s) => !chosen.has(s.slug)).slice(0, 8));
          setActive(-1);
        }
      } catch {
        /* aborted or offline: keep the previous suggestions */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open, tags, suggest]);

  function add(raw: string) {
    const slug = tagSlug(raw);
    if (!slug) return;
    if (tags.some((t) => keyOf(t) === keyOf(raw)) || tags.length >= max) {
      setQuery("");
      return;
    }
    setTags((t) => [...t, suggest ? tagDisplayName(raw) : raw.trim().slice(0, 40)]);
    setQuery("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (active >= 0 && suggestions[active]) add(suggestions[active].name);
      else if (query.trim()) add(query);
    } else if (e.key === "Backspace" && !query && tags.length) {
      setTags((t) => t.slice(0, -1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label} <span className="font-normal text-muted">({tags.length}/{max})</span>
      </label>
      <div className="relative">
        <div
          className={cn(
            "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
            error ? "border-danger" : "border-line-strong",
          )}
        >
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1 text-[13px] text-accent">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((all) => all.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-accent/10">
                <X className="size-3" />
              </button>
              <input type="hidden" name={name} value={t} />
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={tags.length >= max ? "Limit reached" : placeholder}
            disabled={tags.length >= max}
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted/80"
          />
        </div>
        {open && suggestions.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg">
            {suggestions.map((s, i) => (
              <li
                key={s.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s.name);
                }}
                className={cn("flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm", i === active ? "bg-sunken" : "hover:bg-sunken")}
              >
                <span>{s.name}</span>
                {s.usageCount > 0 && <span className="font-mono text-[11px] text-muted">{s.usageCount}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {visiblePresets.length > 0 && tags.length < max && (
        <div ref={presetsRef} role="group" aria-label={`${presetsLabel}: ${label}`} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{presetsLabel}:</span>
          {visiblePresets.map((p, i) => (
            <button
              key={p}
              type="button"
              data-preset
              aria-label={`Add ${p}`}
              onClick={() => {
                focusPresetAt.current = i;
                add(p);
              }}
              className="inline-flex min-h-7 items-center gap-1 rounded-full border border-line-strong bg-surface px-2.5 text-[13px] text-ink-2 hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-3" aria-hidden />
              {p}
            </button>
          ))}
          {remainingPresets.length > PRESETS_COLLAPSED && (
            <button
              type="button"
              aria-expanded={showAllPresets}
              onClick={() => setShowAllPresets((v) => !v)}
              className="min-h-7 px-1.5 text-[13px] font-medium text-accent underline-offset-2 hover:underline"
            >
              {showAllPresets ? "Show fewer" : `Show all (${remainingPresets.length})`}
            </button>
          )}
        </div>
      )}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
