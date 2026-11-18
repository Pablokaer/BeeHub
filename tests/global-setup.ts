import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Applies migrations to the test database once per test run. */
export default function setup() {
  config({ path: ".env.test", override: true, quiet: true });
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env } });
}
