import "server-only";
import { isValidHandle } from "@/lib/slug";
import { db, type Tx } from "./db";
import { ValidationError } from "./errors";

/** Throws a field-level validation error if the handle is invalid or taken. */
export async function assertHandleAvailable(handle: string, field: string, tx: Tx = db, ownedBy?: { userId?: string; organizationId?: string; projectId?: string }) {
  const h = handle.toLowerCase();
  if (!isValidHandle(h)) throw new ValidationError("Please check the highlighted fields.", { [field]: "Invalid or reserved name" });
  const existing = await tx.handle.findUnique({ where: { handle: h } });
  if (!existing) return;
  if (ownedBy && ((ownedBy.userId && existing.userId === ownedBy.userId) || (ownedBy.organizationId && existing.organizationId === ownedBy.organizationId) || (ownedBy.projectId && existing.projectId === ownedBy.projectId))) return;
  throw new ValidationError("Please check the highlighted fields.", { [field]: "That name is already taken" });
}

export type HandleTarget =
  | { kind: "user"; id: string; handle: string; name: string }
  | { kind: "org"; id: string; handle: string; name: string }
  | { kind: "project"; id: string; handle: string; name: string };

/** Resolves @handles to active, publicly visible entities. */
export async function resolveHandles(handles: string[]): Promise<HandleTarget[]> {
  if (handles.length === 0) return [];
  const rows = await db.handle.findMany({
    where: { handle: { in: handles.map((h) => h.toLowerCase()) } },
    select: {
      handle: true,
      user: { select: { id: true, status: true, profile: { select: { displayName: true } } } },
      organization: { select: { id: true, status: true, name: true } },
      project: { select: { id: true, status: true, visibility: true, name: true } },
    },
  });
  const out: HandleTarget[] = [];
  for (const r of rows) {
    if (r.user && r.user.status === "ACTIVE") out.push({ kind: "user", id: r.user.id, handle: r.handle, name: r.user.profile?.displayName ?? r.handle });
    else if (r.organization && r.organization.status === "ACTIVE") out.push({ kind: "org", id: r.organization.id, handle: r.handle, name: r.organization.name });
    else if (r.project && r.project.status === "ACTIVE" && r.project.visibility === "PUBLIC") out.push({ kind: "project", id: r.project.id, handle: r.handle, name: r.project.name });
  }
  return out;
}

export function hrefForHandle(t: Pick<HandleTarget, "kind" | "handle">) {
  return t.kind === "user" ? `/u/${t.handle}` : t.kind === "org" ? `/o/${t.handle}` : `/p/${t.handle}`;
}
