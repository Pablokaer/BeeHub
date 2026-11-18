import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ForbiddenError, isAppError } from "./errors";
import { logger } from "./logger";

/** Uniform JSON error envelope for route handlers: { error: { code, message, fields? } }. */
export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    // Let Next.js handle its own control-flow signals (e.g. bailing out of prerendering).
    unstable_rethrow(e);
    if (isAppError(e)) {
      return NextResponse.json({ error: { code: e.code, message: e.message, fields: e.fieldErrors } }, { status: e.status });
    }
    logger.error("api.unhandled", { err: e });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
  }
}

/**
 * CSRF defence for cookie-authenticated mutations in route handlers (server actions
 * get the same check from Next.js): the Origin must match the Host.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new ForbiddenError("Cross-site request blocked.");
  try {
    if (new URL(origin).host !== host) throw new ForbiddenError("Cross-site request blocked.");
  } catch {
    throw new ForbiddenError("Cross-site request blocked.");
  }
}
