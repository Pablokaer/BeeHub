"use client";

import { createContext, startTransition, useActionState, useCallback, useContext, useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { cn } from "./cn";
import { useToast } from "./toast";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(null);
const FormPendingContext = createContext(false);

export function useFieldError(name?: string) {
  const state = useContext(FormStateContext);
  if (!name || !state || state.ok) return undefined;
  return state.fieldErrors?.[name];
}

/**
 * Form bound to a server action through useActionState. Field-level errors flow to
 * <Field>/<Input> through context; the form-level message is announced to screen readers.
 */
export function ActionForm({
  action,
  children,
  className,
  successToast = true,
  resetOnSuccess = false,
  onSuccess,
  ...rest
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: Action;
  successToast?: boolean;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
}) {
  const toast = useToast();
  // Toasts are raised as soon as the action settles, so feedback survives even when the
  // form itself disappears from the re-rendered page (e.g. an accepted request).
  const run = useCallback(
    async (prev: ActionState, fd: FormData) => {
      const r = await action(prev, fd);
      if (r?.ok && successToast && r.message) toast(r.message, "success");
      else if (r && !r.ok && (!r.fieldErrors || Object.keys(r.fieldErrors).length === 0)) toast(r.message, "error");
      return r;
    },
    [action, toast, successToast],
  );
  const [state, formAction, pending] = useActionState(run, null);
  const ref = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <FormStateContext.Provider value={state}>
      <FormPendingContext.Provider value={pending}>
      <form
        ref={ref}
        action={formAction}
        // With JavaScript, submit through a transition instead of the native form action so
        // React doesn't clear what the user typed when the server returns validation errors.
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => formAction(fd));
        }}
        className={className}
        noValidate
        {...rest}
      >
        {state && !state.ok && state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
          <FormAlert kind="error">{state.message}</FormAlert>
        )}
        {children}
      </form>
      </FormPendingContext.Provider>
    </FormStateContext.Provider>
  );
}

export function FormAlert({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        kind === "error" && "border-danger/30 bg-danger-soft text-danger",
        kind === "success" && "border-success/30 bg-success-soft text-success",
        kind === "info" && "border-line bg-sunken text-ink-2",
      )}
    >
      {kind === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

const FieldIdContext = createContext<{ id: string; name?: string; describedBy?: string } | null>(null);

export function Field({
  label,
  name,
  hint,
  children,
  className,
  optional,
}: {
  label: ReactNode;
  name?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  const error = useFieldError(name);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <FieldIdContext.Provider value={{ id, name, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldIdContext.Provider>
  );
}

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/80 transition-colors hover:border-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-[invalid=true]:border-danger disabled:opacity-60";

/** id, aria-invalid and aria-describedby for a custom control rendered inside <Field>. */
export function useControlProps(name?: string) {
  const ctx = useContext(FieldIdContext);
  const error = useFieldError(name ?? ctx?.name);
  return { id: ctx?.id, "aria-invalid": error ? true : undefined, "aria-describedby": ctx?.describedBy };
}

export function Input({ className, name, ...props }: ComponentProps<"input">) {
  const a11y = useControlProps(name);
  return <input name={name} className={cn(control, "h-9", className)} {...a11y} {...props} />;
}

export function Textarea({ className, name, rows = 4, ...props }: ComponentProps<"textarea">) {
  const a11y = useControlProps(name);
  return <textarea name={name} rows={rows} className={cn(control, "py-2 leading-relaxed", className)} {...a11y} {...props} />;
}

export function Select({ className, name, children, ...props }: ComponentProps<"select">) {
  const a11y = useControlProps(name);
  return (
    <select name={name} className={cn(control, "h-9 pr-8", className)} {...a11y} {...props}>
      {children}
    </select>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; pendingLabel?: string }) {
  const status = useFormStatus();
  const contextPending = useContext(FormPendingContext);
  const pending = status.pending || contextPending;
  return (
    <button type="submit" disabled={pending || props.disabled} aria-disabled={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Multi-select rendered as toggle chips (real checkboxes, so it works without JS). */
export function ChoiceChips<T extends string>({
  name,
  options,
  defaultValue = [],
  type = "checkbox",
  legend,
  hint,
}: {
  name: string;
  options: { value: T; label: string }[];
  defaultValue?: T[];
  type?: "checkbox" | "radio";
  legend: ReactNode;
  hint?: ReactNode;
}) {
  const error = useFieldError(name);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type={type} name={name} value={o.value} defaultChecked={defaultValue.includes(o.value)} className="peer sr-only" />
            <span className="inline-flex h-8 items-center rounded-full border border-line-strong bg-surface px-3 text-[13px] text-ink-2 transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 hover:border-ink/30">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

export function Checkbox({ name, label, description, defaultChecked }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 rounded border-line-strong accent-[var(--c-accent)]" />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4", className)}>{children}</div>;
}
