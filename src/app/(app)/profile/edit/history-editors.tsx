"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Education, Experience } from "@/generated/prisma/client";
import { formatMonth, toDateInput } from "@/lib/format";
import { deleteEducationAction, deleteExperienceAction, saveEducationAction, saveExperienceAction } from "@/app/actions/settings";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";

function Shell({ title, onAdd, adding, children }: { title: string; onAdd: () => void; adding: boolean; children: React.ReactNode }) {
  return (
    <section className="panel mt-5 p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function ExperienceForm({ item, onDone }: { item?: Experience; onDone: () => void }) {
  return (
    <ActionForm action={saveExperienceAction} onSuccess={onDone} className="grid gap-3 rounded-md border border-line bg-sunken/60 p-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Title" name="title">
        <Input name="title" defaultValue={item?.title} required />
      </Field>
      <Field label="Company or project" name="company">
        <Input name="company" defaultValue={item?.company} required />
      </Field>
      <Field label="Start date" name="startDate">
        <Input name="startDate" type="date" defaultValue={toDateInput(item?.startDate)} required />
      </Field>
      <Field label="End date" name="endDate" optional hint="Leave empty if this is your current role.">
        <Input name="endDate" type="date" defaultValue={toDateInput(item?.endDate)} />
      </Field>
      <Field label="Location" name="location" optional className="sm:col-span-2">
        <Input name="location" defaultValue={item?.location ?? ""} />
      </Field>
      <Field label="Description" name="description" optional className="sm:col-span-2">
        <Textarea name="description" defaultValue={item?.description ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ExperienceEditor({ items }: { items: Experience[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <Shell title="Experience" onAdd={() => setEditing("new")} adding={editing === "new"}>
      {editing === "new" && <ExperienceForm onDone={() => setEditing(null)} />}
      {items.length === 0 && editing !== "new" && <p className="text-sm text-muted">Add roles, jobs, freelance work or volunteer positions.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((e) =>
          editing === e.id ? (
            <li key={e.id} className="py-3">
              <ExperienceForm item={e} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-[13px] text-ink-2">{e.company}</p>
                <p className="text-xs text-muted">
                  {formatMonth(e.startDate)} – {e.endDate ? formatMonth(e.endDate) : "Present"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e.id)}>
                  <Pencil className="size-3.5" />
                </Button>
                <ActionButton action={deleteExperienceAction} fields={{ id: e.id }} variant="ghost" confirm="Delete?">
                  Delete
                </ActionButton>
              </div>
            </li>
          ),
        )}
      </ul>
    </Shell>
  );
}

function EducationForm({ item, onDone }: { item?: Education; onDone: () => void }) {
  return (
    <ActionForm action={saveEducationAction} onSuccess={onDone} className="grid gap-3 rounded-md border border-line bg-sunken/60 p-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="School" name="school" className="sm:col-span-2">
        <Input name="school" defaultValue={item?.school} required />
      </Field>
      <Field label="Degree" name="degree" optional>
        <Input name="degree" defaultValue={item?.degree ?? ""} />
      </Field>
      <Field label="Field of study" name="field" optional>
        <Input name="field" defaultValue={item?.field ?? ""} />
      </Field>
      <Field label="Start year" name="startYear" optional>
        <Input name="startYear" type="number" min={1950} max={2100} defaultValue={item?.startYear ?? ""} />
      </Field>
      <Field label="End year (or expected)" name="endYear" optional>
        <Input name="endYear" type="number" min={1950} max={2100} defaultValue={item?.endYear ?? ""} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EducationEditor({ items }: { items: Education[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <Shell title="Education" onAdd={() => setEditing("new")} adding={editing === "new"}>
      {editing === "new" && <EducationForm onDone={() => setEditing(null)} />}
      {items.length === 0 && editing !== "new" && <p className="text-sm text-muted">Degrees, courses, bootcamps…</p>}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((e) =>
          editing === e.id ? (
            <li key={e.id} className="py-3">
              <EducationForm item={e} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{e.school}</p>
                <p className="text-[13px] text-ink-2">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                {(e.startYear || e.endYear) && <p className="text-xs text-muted">{[e.startYear, e.endYear].filter(Boolean).join(" – ")}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" aria-label={`Edit ${e.school}`} onClick={() => setEditing(e.id)}>
                  <Pencil className="size-3.5" />
                </Button>
                <ActionButton action={deleteEducationAction} fields={{ id: e.id }} variant="ghost" confirm="Delete?">
                  Delete
                </ActionButton>
              </div>
            </li>
          ),
        )}
      </ul>
    </Shell>
  );
}
