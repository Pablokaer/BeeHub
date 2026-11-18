"use client";

import { useState } from "react";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { applicationStatusLabels } from "@/lib/constants";
import { updateApplicationStatusAction } from "@/app/actions/opportunities";
import { ActionForm, Checkbox, SubmitButton } from "@/components/ui/form";

/** Moves an application through the review workflow (only valid next states are offered). */
export function StatusControl({ applicationId, next, hasProject }: { applicationId: string; next: ApplicationStatus[]; hasProject: boolean }) {
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  if (next.length === 0) return null;
  return (
    <ActionForm action={updateApplicationStatusAction} onSuccess={() => setStatus("")} className="flex flex-col gap-2 rounded-md bg-sunken p-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`st-${applicationId}`} className="text-[13px] font-medium">
          Move to
        </label>
        <select id={`st-${applicationId}`} name="status" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)} required className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px]">
          <option value="" disabled>
            Choose…
          </option>
          {next.map((s) => (
            <option key={s} value={s}>
              {applicationStatusLabels[s]}
            </option>
          ))}
        </select>
        <label htmlFor={`note-${applicationId}`} className="sr-only">
          Note
        </label>
        <input id={`note-${applicationId}`} name="note" placeholder="Private note (optional)" maxLength={500} className="h-8 min-w-[10rem] flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13px]" />
        <SubmitButton size="sm" disabled={!status}>
          Update
        </SubmitButton>
      </div>
      {status === "ACCEPTED" && (
        <div className="flex flex-col gap-2 pt-1">
          {hasProject && <p className="text-xs text-muted">Accepting adds this person to the project team, linked to this opportunity.</p>}
          <Checkbox name="markFilled" label="Mark the opportunity as filled" description="Closes it to new applications." />
        </div>
      )}
    </ActionForm>
  );
}
