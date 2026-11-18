import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { env } from "../env";
import { EmailNotVerifiedError, UnauthenticatedError } from "../errors";
import { createSession, deleteSessionByToken, viewerFromSessionToken } from "./service";
import type { RequestContext, Viewer } from "./types";

export const SESSION_COOKIE = "ch_session";

/** Current viewer for this request (deduplicated per render with React cache). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Everything downstream of the viewer is per-request (personalized, time-dependent).
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return viewerFromSessionToken(token);
});

/** For pages: redirects to login when signed out. */
export async function requireViewerPage(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return viewer;
}

/** For actions and route handlers: throws instead of redirecting. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthenticatedError();
  return viewer;
}

/** Publishing operations require a verified email (configurable). */
export async function requireVerifiedViewer(): Promise<Viewer> {
  const viewer = await requireViewer();
  assertVerified(viewer);
  return viewer;
}

export function assertVerified(viewer: Pick<Viewer, "emailVerified">) {
  if (env().REQUIRE_EMAIL_VERIFICATION && !viewer.emailVerified) throw new EmailNotVerifiedError();
}

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return {
    ip: (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) ?? "local",
    userAgent: h.get("user-agent"),
  };
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function startSession(userId: string) {
  const ctx = await getRequestContext();
  const { token, expiresAt } = await createSession(userId, ctx);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByToken(token);
  jar.delete(SESSION_COOKIE);
}
