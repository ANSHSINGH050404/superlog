import type { DB } from "@superlog/db";
import { sql } from "drizzle-orm";
import type {
  AuthRateLimitConsumeInput,
  AuthRateLimitConsumeResult,
  AuthRateLimitRepository,
} from "./auth-global-rate-limit.js";

type QueryRow = { lastRequest: number | string };

function rowsFrom(result: unknown): QueryRow[] {
  return Array.isArray(result)
    ? (result as QueryRow[])
    : ((result as { rows?: QueryRow[] }).rows ?? []);
}

export function createDrizzleAuthRateLimitRepository(
  database: Pick<DB, "execute">,
): AuthRateLimitRepository {
  const consume = async (input: AuthRateLimitConsumeInput): Promise<AuthRateLimitConsumeResult> => {
    const windowStart = input.nowEpochMs - input.windowMs;
    const consumed = rowsFrom(
      await database.execute<QueryRow>(sql`
        INSERT INTO rate_limits (id, key, count, last_request)
        VALUES (gen_random_uuid(), ${input.key}, 1, ${input.nowEpochMs})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN rate_limits.last_request <= ${windowStart} THEN 1
            ELSE rate_limits.count + 1
          END,
          last_request = CASE
            WHEN rate_limits.last_request <= ${windowStart} THEN ${input.nowEpochMs}
            ELSE rate_limits.last_request
          END
        WHERE rate_limits.last_request <= ${windowStart}
           OR rate_limits.count < ${input.max}
        RETURNING last_request AS "lastRequest"
      `),
    );
    if (consumed.length > 0) return { allowed: true, retryAfterSeconds: null };

    const current = rowsFrom(
      await database.execute<QueryRow>(sql`
        SELECT last_request AS "lastRequest"
        FROM rate_limits
        WHERE key = ${input.key}
        LIMIT 1
      `),
    )[0];
    // A concurrent cleanup can remove the row between the two statements. In
    // that case retry the atomic consume against the now-empty bucket.
    if (!current) return consume(input);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((Number(current.lastRequest) + input.windowMs - input.nowEpochMs) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  };

  return { consume };
}
