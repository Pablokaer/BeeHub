import type { SiteRole, UserStatus } from "@/generated/prisma/enums";

/** The authenticated user performing an operation. Services receive this explicitly. */
export type Actor = {
  id: string;
  username: string;
  role: SiteRole;
  status: UserStatus;
  emailVerified: boolean;
};

/** Actor plus the minimal profile data the UI shell needs. Never contains secrets. */
export type Viewer = Actor & {
  email: string;
  displayName: string;
  avatarKey: string | null;
  /** Catalog illustration id (see src/lib/art-catalog.ts); never set together with avatarKey. */
  avatarArt: string | null;
  headline: string | null;
};

export type RequestContext = { ip?: string | null; userAgent?: string | null };

export const isStaff = (a: Pick<Actor, "role"> | null | undefined) => a?.role === "ADMIN" || a?.role === "MODERATOR";
