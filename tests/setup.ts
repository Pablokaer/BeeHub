import { config } from "dotenv";

config({ path: ".env.test", override: true, quiet: true });
// Allow pointing the suite at another database (e.g. a non-default port) without editing .env.test.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
// The env module caches values on first read; make sure it sees the test configuration.
(process.env as Record<string, string>).NODE_ENV = "test";
