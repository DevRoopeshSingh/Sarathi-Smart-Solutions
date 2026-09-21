import "server-only";
import { createHmac } from "node:crypto";
import { getPool } from "./db";
import { readServerEnvironment } from "./env";

export interface RateLimitRule {
  window: number;
  max: number;
}
export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number | null;
}

/** Better Auth 1.7 consume contract: https://better-auth.com/docs/concepts/rate-limit */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitDecision> {
  if (
    !Number.isSafeInteger(rule.window) ||
    rule.window < 1 ||
    !Number.isSafeInteger(rule.max) ||
    rule.max < 1 ||
    rule.max > 100_000
  ) {
    throw new Error("Invalid rate limit rule.");
  }
  // Keyed hashes prevent dictionary recovery of login emails from the counter table.
  const storedKey = createHmac("sha256", readServerEnvironment().authSecret)
    .update(key)
    .digest("hex");
  const pool = getPool();
  await pool.query(`DELETE FROM sarathi.auth_ratelimits WHERE expires_at < statement_timestamp() AND key IN (
    SELECT key FROM sarathi.auth_ratelimits WHERE expires_at < statement_timestamp()
    ORDER BY expires_at LIMIT 100
  )`);
  const result = await pool.query<{ allowed: boolean; retry_after: number }>(
    `
    INSERT INTO sarathi.auth_ratelimits AS counter (key, count, expires_at)
    VALUES ($1, 1, statement_timestamp() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN counter.expires_at <= statement_timestamp() THEN 1
                   ELSE LEAST(counter.count + 1, $3 + 1) END,
      expires_at = CASE WHEN counter.expires_at <= statement_timestamp()
                       THEN EXCLUDED.expires_at ELSE counter.expires_at END
    RETURNING count <= $3 AS allowed,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - statement_timestamp())))::integer AS retry_after
  `,
    [storedKey, rule.window, rule.max]
  );
  const row = result.rows[0];
  return { allowed: row.allowed, retryAfter: row.allowed ? null : row.retry_after };
}
