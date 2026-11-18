"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { OpportunityStatus, ApplicationStatus } from "@/generated/prisma/enums";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { applicationSchema, opportunitySchema } from "@/lib/validation";
import { parse, parseForm, runAction, setFlash } from "@/server/action-utils";
import { requireVerifiedViewer, requireViewer } from "@/server/auth/viewer";
import { createOpportunity, setOpportunityStatus, updateOpportunity } from "@/server/opportunities";
import { applyToOpportunity, updateApplicationStatus, withdrawApplication } from "@/server/applications";

export async function createOpportunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    const input = parseForm(opportunitySchema, formData, ["skills", "topics"]);
    const opp = await createOpportunity(viewer, input, { announce: formData.get("announce") === "on" });
    await setFlash(input.publish ? "Opportunity published. Matching members will be notified." : "Draft saved.");
    redirect(`/opportunities/${opp.id}`);
  });
}

export async function updateOpportunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const id = String(formData.get("opportunityId"));
    const input = parseForm(opportunitySchema, formData, ["skills", "topics"]);
    await updateOpportunity(viewer, id, input);
    await setFlash("Opportunity saved.");
    redirect(`/opportunities/${id}`);
  });
}

export async function setOpportunityStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const status = parse(z.enum(OpportunityStatus), String(formData.get("status")));
    await setOpportunityStatus(viewer, String(formData.get("opportunityId")), status);
    refresh();
    const msg: Partial<Record<OpportunityStatus, string>> = {
      OPEN: "Opportunity is open for applications.",
      CLOSED: "Opportunity closed. It no longer accepts applications.",
      FILLED: "Marked as filled.",
      ARCHIVED: "Archived. Applications are kept for your records.",
    };
    return { ok: true, message: msg[status] ?? "Updated." };
  });
}

export async function applyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireVerifiedViewer();
    await applyToOpportunity(viewer, parseForm(applicationSchema, formData));
    refresh();
    return { ok: true, message: "Application sent. You can follow its status under Applications." };
  });
}

export async function withdrawApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await withdrawApplication(viewer, String(formData.get("applicationId")));
    refresh();
    return { ok: true, message: "Application withdrawn." };
  });
}

export async function updateApplicationStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const status = parse(z.enum(ApplicationStatus), String(formData.get("status")));
    await updateApplicationStatus(viewer, String(formData.get("applicationId")), status, {
      note: String(formData.get("note") ?? "").trim().slice(0, 500) || undefined,
      markFilled: formData.get("markFilled") === "on",
      addToTeam: formData.get("addToTeam") !== "off",
    });
    refresh();
    return { ok: true, message: "Application updated. The applicant was notified." };
  });
}
