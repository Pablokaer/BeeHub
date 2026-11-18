"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { collaborationLabels, commitmentLabels, compensationLabels, durationLabels, enumKeys, experienceLabels, opportunityCategoryLabels, workModeLabels } from "@/lib/constants";
import { ActionForm, Checkbox, Field, FormActions, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";

export type OpportunityFormValues = {
  id?: string;
  owner: string;
  title: string;
  description: string;
  category: string;
  collaborationType: string;
  workMode: string;
  location: string | null;
  experienceLevel: string | null;
  duration: string | null;
  commitment: string | null;
  compensationType: string;
  compensation: string | null;
  deadline: string;
  skills: string[];
  topics: string[];
  status?: string;
};

export function OpportunityForm({ action, owners, values }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; owners: { value: string; label: string }[]; values?: OpportunityFormValues }) {
  const [workMode, setWorkMode] = useState(values?.workMode ?? "REMOTE");
  const [comp, setComp] = useState(values?.compensationType ?? "NONE");
  const isDraft = !values?.status || values.status === "DRAFT";
  return (
    <ActionForm action={action} className="panel flex flex-col gap-5 p-5">
      {values?.id && <input type="hidden" name="opportunityId" value={values.id} />}
      <Field label="Published by" name="owner" hint={values?.id ? "The publisher can't be changed after creation." : "Opportunities can belong to you, one of your projects or an organization you manage."}>
        <Select name="owner" defaultValue={values?.owner ?? owners[0]?.value} disabled={!!values?.id}>
          {owners.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {values?.id && <input type="hidden" name="owner" value={values.owner} />}
      <Field label="Looking for…" name="title" hint="Be specific: “React developer for our study-assistant MVP”, “Retail partner for a payments pilot”.">
        <Input name="title" defaultValue={values?.title} required maxLength={120} placeholder="Frontend developer" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of collaboration" name="collaborationType">
          <Select name="collaborationType" defaultValue={values?.collaborationType ?? "VOLUNTEER"}>
            {enumKeys(collaborationLabels).map((v) => (
              <option key={v} value={v}>
                {collaborationLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" name="category">
          <Select name="category" defaultValue={values?.category ?? "ENGINEERING"}>
            {enumKeys(opportunityCategoryLabels).map((v) => (
              <option key={v} value={v}>
                {opportunityCategoryLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" name="description" hint="What will they do? What do you offer in return? How will you work together?">
        <Textarea name="description" defaultValue={values?.description} required rows={7} maxLength={8000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <TagInput name="skills" label="Skills wanted" defaultValue={values?.skills} max={15} hint="Used for matching. At least one." />
        <TagInput name="topics" label="Topics" defaultValue={values?.topics} max={10} hint="Domain or theme: AI, Fintech, Education…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Work mode" name="workMode">
          <Select name="workMode" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
            {enumKeys(workModeLabels).map((v) => (
              <option key={v} value={v}>
                {workModeLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location" name="location" optional={workMode === "REMOTE"} hint={workMode === "REMOTE" ? "Time zone or region, if relevant." : "Where people need to be."}>
          <Input name="location" defaultValue={values?.location ?? ""} maxLength={80} />
        </Field>
        <Field label="Experience level" name="experienceLevel" optional>
          <Select name="experienceLevel" defaultValue={values?.experienceLevel ?? ""}>
            <option value="">Any level</option>
            {enumKeys(experienceLabels).map((v) => (
              <option key={v} value={v}>
                {experienceLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated duration" name="duration" optional>
          <Select name="duration" defaultValue={values?.duration ?? ""}>
            <option value="">Not specified</option>
            {enumKeys(durationLabels).map((v) => (
              <option key={v} value={v}>
                {durationLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected availability" name="commitment" optional>
          <Select name="commitment" defaultValue={values?.commitment ?? ""}>
            <option value="">Not specified</option>
            {enumKeys(commitmentLabels).map((v) => (
              <option key={v} value={v}>
                {commitmentLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Application deadline" name="deadline" optional>
          <Input name="deadline" type="date" defaultValue={values?.deadline ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Compensation" name="compensationType">
          <Select name="compensationType" value={comp} onChange={(e) => setComp(e.target.value)}>
            {enumKeys(compensationLabels).map((v) => (
              <option key={v} value={v}>
                {compensationLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        {comp !== "NONE" && (
          <Field label="Compensation details" name="compensation" optional hint="e.g. €30–40/h, 0.5% equity, €500 stipend">
            <Input name="compensation" defaultValue={values?.compensation ?? ""} maxLength={120} />
          </Field>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-md bg-sunken p-3">
        {isDraft ? (
          <Checkbox name="publish" label="Publish now" description="Open for applications immediately. Uncheck to save a draft." defaultChecked />
        ) : (
          <input type="hidden" name="publish" value="on" />
        )}
        {!values?.id && <Checkbox name="announce" label="Announce in the feed" description="Creates an “Opportunity” post for followers of the publisher." defaultChecked />}
      </div>
      <FormActions>
        <SubmitButton pendingLabel="Saving…">{values?.id ? "Save changes" : "Create opportunity"}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
