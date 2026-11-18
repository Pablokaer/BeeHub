"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { useToast } from "./toast";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A single-button form for one-off actions (follow, accept, archive…).
 * `fields` become hidden inputs. With `confirm`, the first click asks for confirmation inline.
 */
export function ActionButton({
  action,
  fields = {},
  children,
  variant = "secondary",
  size = "sm",
  className,
  confirm,
  successToast = true,
  ariaLabel,
  title,
}: {
  action: Action;
  fields?: Record<string, string | number | boolean | null | undefined>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  confirm?: string;
  successToast?: boolean;
  ariaLabel?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const toast = useToast();
  // Feedback is raised when the action settles, even if this button is gone after the refresh.
  const run = useCallback(
    async (prev: ActionState, fd: FormData) => {
      const r = await action(prev, fd);
      setArmed(false);
      if (r && !r.ok) toast(r.message, "error");
      else if (r?.ok && successToast && r.message) toast(r.message, "success");
      return r;
    },
    [action, toast, successToast],
  );
  const [, formAction, pending] = useActionState(run, null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className="inline-flex"
    >
      {Object.entries(fields).map(([k, v]) => (v === undefined || v === null ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      <button
        type="submit"
        disabled={pending}
        aria-label={armed ? confirm : ariaLabel}
        title={title}
        className={buttonClass(armed ? "danger" : variant, size, className)}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {armed ? confirm : children}
      </button>
    </form>
  );
}
