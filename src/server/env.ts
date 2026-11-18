import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : ["1", "true", "yes"].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REQUIRE_EMAIL_VERIFICATION: bool.default(true),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  SMTP_URL: z.string().optional().default(""),
  MAIL_FROM: z.string().default("BeeHub <no-reply@collabhub.local>"),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(20).default(5),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SCRYPT_FAST: bool.default(false),
  CRON_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
