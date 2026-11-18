"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, Field, Input, SubmitButton } from "./ui/form";
import { ImageUpload } from "./ui/image-upload";

export function GalleryUploadForm({ action, projectId }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; projectId: string }) {
  const [key, setKey] = useState(0);
  return (
    <ActionForm key={key} action={action} onSuccess={() => setKey((k) => k + 1)} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <input type="hidden" name="projectId" value={projectId} />
      <ImageUpload name="key" label="Image" purpose="gallery" shape="wide" />
      <Field label="Caption" name="caption" optional>
        <Input name="caption" maxLength={200} />
      </Field>
      <SubmitButton>Add to gallery</SubmitButton>
    </ActionForm>
  );
}
