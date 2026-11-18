"use client";

import type { Profile } from "@/generated/prisma/client";
import { availabilityLabels, collaborationLabels, enumKeys, experienceLabels, workModeLabels } from "@/lib/constants";
import { updateProfileAction } from "@/app/actions/settings";
import { ActionForm, ChoiceChips, Field, FormActions, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { INTEREST_PRESETS, LANGUAGE_PRESETS, SKILL_PRESETS } from "@/lib/profile-presets";
import { ProfileImageField } from "./profile-image-field";
import { ProfileLinksEditor } from "@/components/profile-links-editor";

type Data = { profile: Profile; links: { label: string; url: string }[]; skills: string[]; interests: string[] };

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid gap-4 border-b border-line py-6 first:pt-0 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ProfileForm({ data }: { data: Data }) {
  const p = data.profile;
  return (
    <ActionForm action={updateProfileAction} className="panel p-5 sm:p-6">
      <Section title="Basics">
        <ProfileImageField kind="avatar" personName={p.displayName} initial={{ key: p.avatarKey, art: p.avatarArt }} />
        <ProfileImageField kind="cover" personName={p.displayName} initial={{ key: p.coverKey, art: p.coverArt }} />
        <Field label="Name" name="displayName">
          <Input name="displayName" defaultValue={p.displayName} required maxLength={80} />
        </Field>
        <Field label="Headline" name="headline" optional hint="e.g. Frontend developer · CS student at Porto · Building tools for NGOs">
          <Input name="headline" defaultValue={p.headline ?? ""} maxLength={120} />
        </Field>
        <Field label="Location" name="location" optional hint="City or region. You can hide it in privacy settings.">
          <Input name="location" defaultValue={p.location ?? ""} maxLength={80} />
        </Field>
        <Field label="About" name="bio" optional>
          <Textarea name="bio" defaultValue={p.bio ?? ""} rows={5} maxLength={2000} />
        </Field>
      </Section>

      <Section id="skills" title="Skills & interests" description="Used by search, filters and matching. Pick from suggestions when possible.">
        <TagInput name="skills" label="Skills" defaultValue={data.skills} max={30} presets={SKILL_PRESETS} hint="Click suggestions to add them, or type your own and press Enter." />
        <TagInput name="interests" label="Interests" defaultValue={data.interests} max={20} presets={INTEREST_PRESETS} hint="Topics you want to work on. Click suggestions or type your own." />
        <TagInput name="languages" label="Languages" defaultValue={p.languages} max={10} suggest={false} presets={LANGUAGE_PRESETS} placeholder="e.g. English" />
      </Section>

      <Section id="availability" title="Availability" description="Select everything that applies. “Not available” hides you from recommendations.">
        <ChoiceChips name="availability" legend="I'm currently…" options={enumKeys(availabilityLabels).map((v) => ({ value: v, label: availabilityLabels[v] }))} defaultValue={p.availability} />
      </Section>

      <Section title="Work preferences">
        <Field label="Experience level" name="experienceLevel" optional>
          <Select name="experienceLevel" defaultValue={p.experienceLevel ?? ""}>
            <option value="">Prefer not to say</option>
            {enumKeys(experienceLabels).map((v) => (
              <option key={v} value={v}>
                {experienceLabels[v]}
              </option>
            ))}
          </Select>
        </Field>
        <ChoiceChips name="preferredWorkModes" legend="Work mode" options={enumKeys(workModeLabels).map((v) => ({ value: v, label: workModeLabels[v] }))} defaultValue={p.preferredWorkModes} />
        <ChoiceChips name="preferredCollabs" legend="Types of collaboration I'm interested in" options={enumKeys(collaborationLabels).map((v) => ({ value: v, label: collaborationLabels[v] }))} defaultValue={p.preferredCollabs} />
      </Section>

      <Section id="links" title="Links" description="LinkedIn, GitHub, your website and other profiles.">
        <ProfileLinksEditor initialLinks={data.links} />
      </Section>

      <FormActions className="border-0 pt-6">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
