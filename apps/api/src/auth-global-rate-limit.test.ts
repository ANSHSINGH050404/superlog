import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceGlobalAuthRateLimit } from "./auth-global-rate-limit.js";

test("the global auth limit uses one per-IP bucket across every auth route", async () => {
  const calls: unknown[] = [];
  const response = await enforceGlobalAuthRateLimit(
    {
      consume: async (input) => {
        calls.push(input);
        return { allowed: false, retryAfterSeconds: 17 };
      },
    },
    "198.51.100.42",
    1_800_000_000_000,
  );

  assert.deepEqual(calls, [
    {
      key: "auth:global:198.51.100.42",
      max: 60,
      windowMs: 60_000,
      nowEpochMs: 1_800_000_000_000,
    },
  ]);
  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get("retry-after"), "17");
});

test("the global auth limit falls through when the request is allowed", async () => {
  const response = await enforceGlobalAuthRateLimit(
    { consume: async () => ({ allowed: true, retryAfterSeconds: null }) },
    undefined,
    1_800_000_000_000,
  );

  assert.equal(response, null);
});
