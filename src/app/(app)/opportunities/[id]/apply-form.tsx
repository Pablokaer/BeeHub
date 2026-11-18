"use client";

import { applyAction } from "@/app/actions/opportunities";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";

export function ApplyForm({ opportunityId, orgs }: { opportunityId: string; orgs: { id: string; name: string }[] }) {
  return (
    <ActionForm action={applyAction} className="flex flex-col gap-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Field label="Why are you a good fit?" name="message" hint="Mention relevant experience, what you'd like to contribute and your availability.">
        <Textarea name="message" rows={6} required minLength={20} maxLength={3000} />
      </Field>
      <Field label="Portfolio or relevant link" name="portfolioUrl" optional>
        <Input name="portfolioUrl" type="url" placeholder="https://" />
      </Field>
      {orgs.length > 0 && (
        <Field label="Apply as" name="organizationId" hint="Organizations can express interest in partnerships on their own behalf.">
          <Select name="organizationId" defaultValue="">
            <option value="">Myself</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <SubmitButton pendingLabel="Sending…">Send application</SubmitButton>
    </ActionForm>
  );
}
