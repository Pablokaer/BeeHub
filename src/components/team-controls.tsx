"use client";

import type { MemberRole } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import { memberRoleLabels } from "@/lib/constants";
import { ActionForm, Field, Input, Select, SubmitButton } from "./ui/form";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
const RANK: Record<MemberRole, number> = { MEMBER: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 };

export function InviteForm({ action, entityField, actorRole }: { action: Action; entityField: { name: string; value: string }; actorRole: MemberRole }) {
  const roles = (["ADMIN", "EDITOR", "MEMBER"] as MemberRole[]).filter((r) => actorRole === "OWNER" || RANK[r] < RANK[actorRole]);
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1.2fr_auto] sm:items-end">
      <input type="hidden" name={entityField.name} value={entityField.value} />
      <Field label="Username" name="username">
        <Input name="username" placeholder="their-username" required autoComplete="off" />
      </Field>
      <Field label="Role" name="role">
        <Select name="role" defaultValue="MEMBER">
          {roles.map((r) => (
            <option key={r} value={r}>
              {memberRoleLabels[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title" name="title" optional>
        <Input name="title" placeholder="e.g. Frontend lead" maxLength={80} />
      </Field>
      <SubmitButton>Send invite</SubmitButton>
    </ActionForm>
  );
}

/** Inline role + title editor for one member. */
export function MemberRoleSelect({ action, fields, role, actorRole, title }: { action: Action; fields: Record<string, string>; role: MemberRole; actorRole: MemberRole; title?: string | null }) {
  const roles = (["ADMIN", "EDITOR", "MEMBER"] as MemberRole[]).filter((r) => actorRole === "OWNER" || RANK[r] < RANK[actorRole]);
  return (
    <ActionForm action={action} className="flex items-center gap-1.5">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {title !== undefined && (
        <>
          <label className="sr-only" htmlFor={`title-${fields.userId}`}>
            Title
          </label>
          <input id={`title-${fields.userId}`} name="title" defaultValue={title ?? ""} placeholder="Title" maxLength={80} className="h-8 w-32 rounded-md border border-line-strong bg-surface px-2 text-[13px]" />
        </>
      )}
      <label className="sr-only" htmlFor={`role-${fields.userId}`}>
        Role
      </label>
      <select id={`role-${fields.userId}`} name="role" defaultValue={role} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px]">
        {roles.map((r) => (
          <option key={r} value={r}>
            {memberRoleLabels[r]}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" variant="secondary">
        Save
      </SubmitButton>
    </ActionForm>
  );
}
