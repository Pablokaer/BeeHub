"use client";

import { useRef, useState } from "react";
import { BriefcaseBusiness, Code2, Globe, Link2, Trash2 } from "lucide-react";
import type { ProfileLink } from "@/lib/profile-links";
import { Button } from "./ui/button";
import { Field, Input, useFieldError } from "./ui/form";

const platforms = [
  { label: "LinkedIn", placeholder: "linkedin.com/in/your-name or username", Icon: BriefcaseBusiness },
  { label: "GitHub", placeholder: "github.com/username or @username", Icon: Code2 },
  { label: "Personal website", placeholder: "yourwebsite.com", Icon: Globe },
  { label: "Other", placeholder: "https://behance.net/your-name", Icon: Link2 },
];

export function ProfileLinksEditor({ initialLinks = [] }: { initialLinks?: ProfileLink[] }) {
  const [rows, setRows] = useState(() => initialLinks.map((link, id) => ({ ...link, id })));
  const nextId = useRef(initialLinks.length);
  const error = useFieldError("links");
  const add = (platform: string) => {
    if (rows.length >= 8) return;
    const id = nextId.current++;
    setRows(all => [...all, { id, label: platform === "Other" ? "" : platform, url: "" }]);
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted">Add profiles and websites for people to explore. These links will appear on your public profile.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Add a platform link">
        {platforms.map(({ label, Icon }) => <Button key={label} variant="secondary" size="sm" disabled={rows.length >= 8} onClick={() => add(label)}><Icon className="size-4" aria-hidden />{label}</Button>)}
      </div>
      {rows.map(row => {
        const preset = platforms.find(p => p.label === row.label && p.label !== "Other");
        return (
          <div key={row.id} className="flex min-w-0 items-start gap-2 border-t border-line pt-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {preset ? <><p className="text-sm font-medium">{preset.label}</p><input type="hidden" name="links[].label" value={preset.label} /></> : <Field label="Link name"><Input name="links[].label" value={row.label} onChange={e => setRows(all => all.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))} placeholder="e.g. Behance, Dribbble, portfolio" maxLength={40} /></Field>}
              <Field label={`${preset?.label ?? (row.label || "Other link")} URL${preset?.label === "GitHub" || preset?.label === "LinkedIn" ? " or username" : ""}`}>
                <Input name="links[].url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={row.url} onChange={e => setRows(all => all.map(r => r.id === row.id ? { ...r, url: e.target.value } : r))} placeholder={preset?.placeholder ?? "https://"} maxLength={500} />
              </Field>
            </div>
            <Button variant="ghost" aria-label={`Remove ${preset?.label ?? (row.label || "link")}`} onClick={() => setRows(all => all.filter(r => r.id !== row.id))}><Trash2 className="size-4" aria-hidden /></Button>
          </div>
        );
      })}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">{rows.length}/8 links. You can edit or remove them later.</p>
    </div>
  );
}
