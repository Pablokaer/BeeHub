import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

function createClient() {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

/** Shared Prisma client (one per process; reused across hot reloads in development). */
export const db = globalForPrisma.prisma ?? createClient();

if (env().NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
/** Either the root client or an interactive transaction client. */
export type Tx = Omit<Db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
