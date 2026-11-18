"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { requestPartnershipAction } from "@/app/actions/teams";
import { ActionForm, Field, Select, SubmitButton, Textarea } from "./ui/form";
import { Button } from "./ui/button";

/** Lets a project/org admin propose a formal partnership to the entity being viewed. */
export function PartnershipRequest({ targetType, targetId, targetName, identities }: { targetType: "project" | "org"; targetId: string; targetName: string; identities: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  if (identities.length === 0) return null;
  if (!open)
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Handshake className="size-4" aria-hidden /> Propose partnership
      </Button>
    );
  return (
    <ActionForm action={requestPartnershipAction} onSuccess={() => setOpen(false)} className="mt-3 flex w-full flex-col gap-3 rounded-md border border-line bg-sunken/60 p-4">
      <p className="text-sm font-medium">Propose a partnership with {targetName}</p>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <Field label="On behalf of" name="from">
        <Select name="from" defaultValue={identities[0].value}>
          {identities.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Message" name="message" optional hint="How would you collaborate? What does each side bring?">
        <Textarea name="message" rows={3} maxLength={1000} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton size="sm">Send request</SubmitButton>
      </div>
    </ActionForm>
  );
}
