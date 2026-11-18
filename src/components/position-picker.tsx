"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { findPosition, POSITION_AREAS, POSITIONS, searchPositions, type Position } from "@/lib/positions";
import { useControlProps } from "./ui/form";
import { cn } from "./ui/cn";

type Props = {
  /** Form field name; one hidden input per selected position. */
  name: string;
  /** Select one position (forms) or several (filters). */
  multiple?: boolean;
  defaultValue?: string | string[] | null;
  onChange?: (ids: string[]) => void;
  placeholder?: string;
  /** Accessible name when not rendered inside <Field> (e.g. filters). */
  label?: string;
  className?: string;
};

/**
 * Autocomplete over the position catalog (src/lib/positions.ts). Typing filters by label and
 * aliases; the list is a WAI-ARIA combobox (arrow keys, Enter, Escape). Only catalog positions
 * can be chosen, so they work as filters everywhere.
 */
export function PositionPicker({ name, multiple = false, defaultValue, onChange, placeholder = "Type to search positions…", label, className }: Props) {
  const initial = (Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []).filter((id) => findPosition(id));
  const [selected, setSelected] = useState<string[]>(initial);
  const single = !multiple ? findPosition(selected[0]) : null;
  const [text, setText] = useState(single?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const a11y = useControlProps(name);
  const uid = useId();
  const listId = `${uid}-list`;

  // Typing a new query in single mode clears the choice until a position is picked again.
  const query = !multiple && single && text === single.label ? "" : text;
  const options = useMemo(() => {
    const list = query.trim() ? searchPositions(query, 60) : POSITIONS;
    return list.filter((p) => !(multiple && selected.includes(p.id)));
  }, [query, multiple, selected]);
  const grouped = !query.trim();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function commit(next: string[]) {
    setSelected(next);
    onChange?.(next);
  }

  function choose(p: Position) {
    if (multiple) {
      commit([...selected, p.id]);
      setText("");
    } else {
      commit([p.id]);
      setText(p.label);
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the surrounding form from here; pick the highlighted position instead.
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active]);
      } else if (!multiple && text && text !== single?.label) {
        e.preventDefault();
        setOpen(true);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        if (!multiple) setText(single?.label ?? "");
      }
    } else if (e.key === "Backspace" && multiple && !text && selected.length) {
      commit(selected.slice(0, -1));
    }
  }

  return (
    <div className={cn("relative", className)}>
      {multiple && selected.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label="Selected positions">
          {selected.map((id) => (
            <li key={id} className="inline-flex min-h-8 items-center gap-1 border border-line-strong bg-sunken pl-2 text-[12.5px] font-semibold">
              {findPosition(id)?.label}
              <button type="button" onClick={() => commit(selected.filter((x) => x !== id))} aria-label={`Remove ${findPosition(id)?.label}`} className="grid size-8 place-items-center text-muted hover:text-danger">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${uid}-opt-${active}` : undefined}
          aria-label={label}
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
            if (!multiple && selected.length) commit([]);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (!multiple) setText(findPosition(selected[0])?.label ?? text);
          }}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-md border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-[invalid=true]:border-danger"
          {...(label ? {} : a11y)}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Positions"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto border-2 border-line-strong bg-surface py-1 shadow-[3px_3px_0_var(--c-line-strong)]"
        >
          {options.length === 0 && <li className="px-3 py-2 text-[13px] text-muted">No matching position. Try another word, or choose “Other role”.</li>}
          {options.map((p, i) => {
            const header = grouped && (i === 0 || options[i - 1]!.area !== p.area) ? POSITION_AREAS[p.area].label : null;
            return (
              <li key={p.id} role="presentation">
                {header && (
                  <p className="eyebrow px-3 pb-1 pt-2.5" aria-hidden>
                    {header}
                  </p>
                )}
                <div
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={cn("flex min-h-10 cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm", i === active ? "bg-gold text-gold-ink" : "text-ink")}
                >
                  <span className="font-medium">{p.label}</span>
                  {!grouped && <span className={cn("shrink-0 text-[11.5px]", i === active ? "text-gold-ink" : "text-muted")}>{POSITION_AREAS[p.area].label}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
