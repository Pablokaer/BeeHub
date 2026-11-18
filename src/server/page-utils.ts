import "server-only";
import { notFound } from "next/navigation";
import { isAppError } from "./errors";

/**
 * For pages: domain "not found" or "forbidden" errors render the 404 page, so private
 * or admin-only resources don't reveal that they exist.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
}
