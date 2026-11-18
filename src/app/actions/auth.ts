"use server";

import { safeRedirect } from "@/lib/safe-redirect";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/validation";
import { parseForm, runAction, setFlash } from "@/server/action-utils";
import { authenticate, requestPasswordReset, resendVerification, resetPassword, signup, verifyEmail } from "@/server/auth/service";
import { endSession, getRequestContext, getViewer, requireViewer, startSession } from "@/server/auth/viewer";

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseForm(signupSchema, formData);
    const user = await signup(input, await getRequestContext());
    await startSession(user.id);
    await setFlash("Welcome! We sent you an email to confirm your address.");
    redirect("/profile/edit?welcome=1");
  });
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseForm(loginSchema, formData);
    const user = await authenticate(input.email, input.password, await getRequestContext());
    await startSession(user.id);
    redirect(safeRedirect(formData.get("next")));
  });
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseForm(forgotPasswordSchema, formData);
    await requestPasswordReset(input.email, await getRequestContext());
    return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  });
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseForm(resetPasswordSchema, formData);
    const user = await resetPassword(input.token, input.password, await getRequestContext());
    await startSession(user.id);
    await setFlash("Your password was updated. You're signed in.");
    redirect("/feed");
  });
}

export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const token = String(formData.get("token") ?? "");
    await verifyEmail(token);
    await setFlash("Email confirmed. You can now publish, apply and message.");
    redirect((await getViewer()) ? "/feed" : "/login");
  });
}

export async function resendVerificationAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const viewer = await requireViewer();
    if (viewer.emailVerified) return { ok: true, message: "Your email is already verified." };
    await resendVerification(viewer);
    refresh();
    return { ok: true, message: `We sent a new confirmation link to ${viewer.email}.` };
  });
}
