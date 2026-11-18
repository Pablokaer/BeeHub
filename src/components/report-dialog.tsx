"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import type { ReportTarget } from "@/generated/prisma/enums";
import { reportReasonLabels } from "@/lib/constants";
import { reportAction } from "@/app/actions/social";
import { ActionForm, Field, Select, SubmitButton, Textarea } from "./ui/form";
import { Button } from "./ui/button";

/** Modal report form built on the native <dialog> element (focus trap and Escape for free). */
export function ReportDialog({ targetType, targetId, onClose }: { targetType: ReportTarget; targetId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="report-title"
      className="m-auto w-[min(92vw,420px)] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <ActionForm action={reportAction} onSuccess={() => ref.current?.close()} className="flex flex-col gap-4 p-5">
        <h2 id="report-title" className="flex items-center gap-2 text-base font-semibold">
          <Flag className="size-4 text-danger" aria-hidden /> Report
        </h2>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <Field label="What's the problem?" name="reason">
          <Select name="reason" defaultValue="SPAM" required>
            {Object.entries(reportReasonLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Details" name="details" optional hint="Visible only to moderators.">
          <Textarea name="details" rows={3} maxLength={1000} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <SubmitButton variant="danger">Send report</SubmitButton>
        </div>
      </ActionForm>
    </dialog>
  );
}

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: ReportTarget; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-danger">
        <Flag className="size-3.5" aria-hidden /> {label}
      </button>
      {open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}
