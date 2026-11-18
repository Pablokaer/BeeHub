"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { enumKeys, orgSizeLabels, orgTypeLabels } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { ActionForm, Field, FormActions, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { ImageUpload } from "@/components/ui/image-upload";

export type OrgFormValues = {
  id?: string;
  name: string;
  slug: string;
  type: string;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  website: string | null;
  location: string | null;
  size: string | null;
  logoKey: string | null;
  coverKey: string | null;
  tags: string[];
};

export function OrgForm({ action, values, submitLabel, canChangeSlug = true }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; values?: OrgFormValues; submitLabel: string; canChangeSlug?: boolean }) {
  const [slug, setSlug] = useState(values?.slug ?? "");
  const [touched, setTouched] = useState(!!values?.id);
  return (
    <ActionForm action={action} className="panel flex flex-col gap-5 p-5">
      {values?.id && <input type="hidden" name="organizationId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name" name="name">
          <Input name="name" defaultValue={values?.name} required maxLength={100} onChange={(e) => !touched && setSlug(slugify(e.target.value))} />
        </Field>
        <Field label="Page URL" name="slug" hint={`/o/${slug || "your-org"} · also its @mention handle`}>
          <Input
            name="slug"
            value={slug}
            readOnly={!canChangeSlug}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            required
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" name="type">
          <Select name="type" defaultValue={values?.type ?? "STARTUP"}>
            {enumKeys(orgTypeLabels).map((v) => (
              <option key={v} value={v}>
                {orgTypeLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sector" name="industry" optional>
          <Input name="industry" defaultValue={values?.industry ?? ""} maxLength={80} placeholder="Fintech, Education…" />
        </Field>
        <Field label="Team size" name="size" optional>
          <Select name="size" defaultValue={values?.size ?? ""}>
            <option value="">Not specified</option>
            {enumKeys(orgSizeLabels).map((v) => (
              <option key={v} value={v}>
                {orgSizeLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Tagline" name="tagline" optional>
        <Input name="tagline" defaultValue={values?.tagline ?? ""} maxLength={140} />
      </Field>
      <Field label="Description" name="description" optional>
        <Textarea name="description" defaultValue={values?.description ?? ""} rows={6} maxLength={5000} />
      </Field>
      <TagInput name="tags" label="Areas of expertise" defaultValue={values?.tags} max={20} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" name="website" optional>
          <Input name="website" type="url" defaultValue={values?.website ?? ""} placeholder="https://" />
        </Field>
        <Field label="Location" name="location" optional>
          <Input name="location" defaultValue={values?.location ?? ""} maxLength={80} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUpload name="logoKey" label="Logo" purpose="logo" defaultKey={values?.logoKey} />
        <ImageUpload name="coverKey" label="Cover image" purpose="cover" shape="wide" defaultKey={values?.coverKey} />
      </div>
      <FormActions>
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
