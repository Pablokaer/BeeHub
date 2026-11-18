import { execSync } from "node:child_process";
import pg from "pg";

/** Migrates and empties the E2E database before the run. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://hub:hub@localhost:5432/collab_hub_e2e";
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await client.end();
}
