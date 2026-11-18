import "server-only";
import { db } from "./db";
import { blockedUserIds, getProjectRole } from "./authz";
import { visiblePostWhere } from "./posts";
import type { Actor } from "./auth/types";

/** A random URL is not authorization: resolve a visible attachment or its owner. */
export async function canReadMedia(viewer: Actor | null, key: string): Promise<boolean> {
  const asset = await db.mediaAsset.findUnique({ where: { key }, select: { ownerId: true } });
  if (!asset) return false;
  if (viewer && asset.ownerId === viewer.id) return true;
  const blocked = viewer ? await blockedUserIds(viewer.id) : [];
  const [profile, org, projects, post] = await Promise.all([
    db.profile.findFirst({ where: {
      user: { status: "ACTIVE", id: { notIn: blocked } },
      OR: [ { avatarKey: key }, { coverKey: key, ...(viewer ? {} : { visibility: "PUBLIC" as const }) } ],
    }, select: { userId: true } }),
    db.organization.findFirst({ where: { status: "ACTIVE", OR: [{ logoKey: key }, { coverKey: key }] }, select: { id: true } }),
    db.project.findMany({ where: { status: "ACTIVE", OR: [{ logoKey: key }, { coverKey: key }, { images: { some: { key } } }] }, select: { id: true, visibility: true } }),
    db.post.findFirst({ where: { ...visiblePostWhere(blocked), images: { some: { key } } }, select: { id: true } }),
  ]);
  // Avatars are also displayed in the existing restricted-profile teaser.
  if (profile || org || post || projects.some((p) => p.visibility === "PUBLIC")) return true;
  if (viewer) {
    for (const project of projects) {
      if (await getProjectRole(viewer.id, project.id)) return true;
    }
  }
  return false;
}
