"use client";

import { useState } from "react";
import { enumKeys, projectCategoryLabels, projectStageLabels } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, Checkbox, Field, FormActions, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { TECH_GROUPS, TECH_QUICK_PICKS, TOPIC_GROUPS, TOPIC_QUICK_PICKS } from "@/lib/project-vocabulary";
import { ImageUpload } from "@/components/ui/image-upload";

export type ProjectFormValues = {
  id?: string;
  name: string;
  slug: string;
  summary: string;
  description: string | null;
  goals: string | null;
  needs: string | null;
  category: string;
  stage: string;
  visibility: string;
  websiteUrl: string | null;
  repoUrl: string | null;
  isOpenSource: boolean;
  acceptsBeginners: boolean;
  organizationId: string | null;
  logoKey: string | null;
  coverKey: string | null;
  tech: string[];
  topics: string[];
};

export function ProjectForm({
  action,
  values,
  orgs,
  submitLabel,
  canChangeSlug = true,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  values?: ProjectFormValues;
  orgs: { id: string; name: string }[];
  submitLabel: string;
  canChangeSlug?: boolean;
}) {
  const [slug, setSlug] = useState(values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!values?.id);
  return (
    <ActionForm action={action} className="panel flex flex-col gap-5 p-5">
      {values?.id && <input type="hidden" name="projectId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" name="name">
          <Input
            name="name"
            defaultValue={values?.name}
            required
            maxLength={100}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Project URL" name="slug" hint={`/p/${slug || "your-project"} · also its @mention handle`}>
          <Input
            name="slug"
            value={slug}
            readOnly={!canChangeSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            required
          />
        </Field>
      </div>
      <Field label="One-line summary" name="summary" hint="Shown on cards and search results (10–200 characters).">
        <Input name="summary" defaultValue={values?.summary} required maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category" name="category">
          <Select name="category" defaultValue={values?.category ?? "WEB"}>
            {enumKeys(projectCategoryLabels).map((c) => (
              <option key={c} value={c}>
                {projectCategoryLabels[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage" name="stage">
          <Select name="stage" defaultValue={values?.stage ?? "IDEA"}>
            {enumKeys(projectStageLabels).map((c) => (
              <option key={c} value={c}>
                {projectStageLabels[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visibility" name="visibility" hint="Private projects are hidden from search and public pages.">
          <Select name="visibility" defaultValue={values?.visibility ?? "PUBLIC"}>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private (team only)</option>
          </Select>
        </Field>
      </div>
      {orgs.length > 0 && (
        <Field label="Organization" name="organizationId" optional hint="Admins of the organization will also be able to manage this project.">
          <Select name="organizationId" defaultValue={values?.organizationId ?? ""}>
            <option value="">Personal project</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TagInput name="tech" label="Technologies" defaultValue={values?.tech} max={20} presets={TECH_QUICK_PICKS} vocabulary={TECH_GROUPS} hint="Type to search languages, frameworks, cloud, AI, data, design tools and more, or add your own." />
        <TagInput name="topics" label="Topics" defaultValue={values?.topics} max={15} presets={TOPIC_QUICK_PICKS} vocabulary={TOPIC_GROUPS} hint="The domain or cause: AI, Fintech, Education, Climate… Type or browse the list." />
      </div>
      <Field label="Description" name="description" optional>
        <Textarea name="description" defaultValue={values?.description ?? ""} rows={6} maxLength={10000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Goals" name="goals" optional>
          <Textarea name="goals" defaultValue={values?.goals ?? ""} rows={4} maxLength={3000} />
        </Field>
        <Field label="Current needs" name="needs" optional hint="What would help most right now? Publish concrete opportunities too.">
          <Textarea name="needs" defaultValue={values?.needs ?? ""} rows={4} maxLength={3000} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" name="websiteUrl" optional>
          <Input name="websiteUrl" type="url" defaultValue={values?.websiteUrl ?? ""} placeholder="https://" />
        </Field>
        <Field label="Repository" name="repoUrl" optional>
          <Input name="repoUrl" type="url" defaultValue={values?.repoUrl ?? ""} placeholder="https://github.com/…" />
        </Field>
      </div>
      <div className="flex flex-col gap-3">
        <Checkbox name="isOpenSource" label="Open source" defaultChecked={values?.isOpenSource} />
        <Checkbox name="acceptsBeginners" label="Welcomes beginners and students" description="Shown as “Beginner-friendly” and used in discovery filters." defaultChecked={values?.acceptsBeginners} />
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
