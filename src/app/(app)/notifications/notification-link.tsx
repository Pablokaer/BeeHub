"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

/** Marks the notification read on the server, then navigates to its target. */
export function NotificationLink({ action, id, href, unread, children }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; id: string; href: string; unread: boolean; children: React.ReactNode }) {
  const [, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="href" value={href} />
      <button type="submit" disabled={pending} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-sunken disabled:opacity-70" aria-label={unread ? "Open (unread)" : "Open"}>
        {children}
      </button>
    </form>
  );
}
