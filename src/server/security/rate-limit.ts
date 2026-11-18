import "server-only";
import { db } from "../db";
import { RateLimitError } from "../errors";

export type RateRule = { limit: number; windowSec: number };

/** Central catalogue of limits for sensitive operations. */
export const RATE_RULES = {
  login: { limit: 10, windowSec: 15 * 60 },
  signup: { limit: 5, windowSec: 60 * 60 },
  passwordReset: { limit: 5, windowSec: 60 * 60 },
  verifyEmail: { limit: 5, windowSec: 60 * 60 },
  post: { limit: 30, windowSec: 60 * 60 },
  comment: { limit: 60, windowSec: 60 * 60 },
  message: { limit: 120, windowSec: 60 * 60 },
  newConversation: { limit: 20, windowSec: 24 * 60 * 60 },
  connectionRequest: { limit: 50, windowSec: 24 * 60 * 60 },
  application: { limit: 30, windowSec: 24 * 60 * 60 },
  upload: { limit: 60, windowSec: 60 * 60 },
  report: { limit: 20, windowSec: 60 * 60 },
  invitation: { limit: 50, windowSec: 24 * 60 * 60 },
} satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof RATE_RULES;

/**
 * Fixed-window counter stored in Postgres, so limits hold across server instances.
 * Returns the remaining budget; throws RateLimitError once the limit is exceeded.
 */
export async function rateLimit(name: RateRuleName, subject: string, baseRule: RateRule = RATE_RULES[name]) {
  // Load/E2E test environments can scale limits up (never down) via RATE_LIMIT_MULTIPLIER.
  const multiplier = process.env.NODE_ENV === "test" ? Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1) : 1;
  const rule = { ...baseRule, limit: baseRule.limit * multiplier };
  const key = `${name}:${subject}`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${rule.windowSec})
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${rule.windowSec})
                     THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  if (count > rule.limit) throw new RateLimitError();
  return rule.limit - count;
}

/** Clears a counter (e.g. after a successful login). */
export async function resetRateLimit(name: RateRuleName, subject: string) {
  await db.rateLimit.deleteMany({ where: { key: `${name}:${subject}` } });
}
