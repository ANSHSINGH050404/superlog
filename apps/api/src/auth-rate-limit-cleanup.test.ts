import assert from "node:assert/strict";
import { test } from "node:test";
import { startAuthRateLimitCleanup } from "./auth-rate-limit-cleanup.js";

test("cleans auth rate-limit rows older than the longest configured window on startup", async () => {
  const cutoffs: number[] = [];
  const errors: unknown[] = [];
  const now = () => 1_800_000_000_000;
  const stop = startAuthRateLimitCleanup({
    repository: {
      deleteBefore: async (cutoff) => {
        cutoffs.push(cutoff);
        return 2;
      },
    },
    now,
    intervalMs: 60_000,
    onError: (error) => errors.push(error),
  });

  await new Promise((resolve) => setImmediate(resolve));
  stop();

  assert.deepEqual(cutoffs, [now() - 60 * 60 * 1000]);
  assert.deepEqual(errors, []);
});
