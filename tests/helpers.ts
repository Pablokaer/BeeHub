import { db } from "@/server/db";
import { signup } from "@/server/auth/service";
import type { Actor } from "@/server/auth/types";
import { updateProfile } from "@/server/profiles";

let seq = 0;

/** Truncates every application table (keeps the migration history). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export type TestUser = Actor & { email: string };

export async function createUser(opts: { name?: string; username?: string; verified?: boolean; role?: "USER" | "MODERATOR" | "ADMIN" } = {}): Promise<TestUser> {
  seq += 1;
  const username = opts.username ?? `user${seq}-${Math.random().toString(36).slice(2, 7)}`;
  const u = await signup(
    { displayName: opts.name ?? `User ${seq}`, username, email: `${username}@example.test`, password: "correct horse battery" },
    { ip: `10.0.${seq % 250}.${(seq * 7) % 250}` },
  );
  const updated = await db.user.update({
    where: { id: u.id },
    data: { emailVerifiedAt: opts.verified === false ? null : new Date(), role: opts.role ?? "USER" },
  });
  return { id: updated.id, username: updated.username, role: updated.role, status: updated.status, emailVerified: !!updated.emailVerifiedAt, email: updated.email };
}

export async function setSkills(actor: Actor, skills: string[], extra: Partial<Parameters<typeof updateProfile>[1]> = {}) {
  const p = await db.profile.findUniqueOrThrow({ where: { userId: actor.id } });
  await updateProfile(actor, {
    displayName: p.displayName,
    languages: [],
    links: [],
    availability: [],
    preferredWorkModes: [],
    preferredCollabs: [],
    skills,
    interests: [],
    ...extra,
  });
}

export const viewerOf = (u: TestUser) => ({ ...u, displayName: u.username, avatarKey: null, avatarArt: null, headline: null });
