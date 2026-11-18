import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { fieldErrorsFrom, formToObject } from "@/lib/validation";
import { isAppError, ValidationError } from "./errors";
import { logger } from "./logger";

/** Validates input against a schema, throwing a ValidationError with field messages. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(undefined, fieldErrorsFrom(result.error));
  return result.data;
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData, arrays: string[] = []): z.output<S> {
  return parse(schema, formToObject(formData, arrays));
}

/**
 * Runs an action body and converts domain errors into ActionState. Framework control
 * flow (redirect, notFound) is re-thrown so Next.js can handle it.
 */
export async function runAction<T>(fn: () => Promise<ActionState<T> | void>): Promise<ActionState<T>> {
  try {
    const r = await fn();
    return { ...(r ?? { ok: true }), at: Date.now() } as ActionState<T>;
  } catch (e) {
    unstable_rethrow(e);
    if (isAppError(e)) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, at: Date.now() };
    logger.error("action.unhandled", { err: e });
    return { ok: false, message: "Something went wrong on our side. Please try again.", at: Date.now() };
  }
}

export const FLASH_COOKIE = "ch_flash";

/** Short-lived message shown after a redirect (read and cleared by the client). */
export async function setFlash(message: string, kind: "success" | "error" | "info" = "success") {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false,
  });
}
