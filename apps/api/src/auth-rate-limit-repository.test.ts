import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { DB } from "@superlog/db";
import * as schema from "@superlog/db/schema";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDrizzleAuthRateLimitRepository } from "./auth-rate-limit-repository.js";

const key = `auth:global:test-${Date.now()}-${Math.random()}`;
const migrations = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);
const client = new PGlite();
const pgliteDatabase = drizzle(client, { schema });
const database = pgliteDatabase as unknown as DB;

before(async () => {
  await migrate(pgliteDatabase, { migrationsFolder: migrations });
});

after(async () => {
  await client.close();
});

test("atomically caps concurrent requests and resets after the window", async () => {
  const repository = createDrizzleAuthRateLimitRepository(database);
  const nowEpochMs = 1_800_000_000_000;
  const input = { key, max: 60, windowMs: 60_000, nowEpochMs };

  const decisions = await Promise.all(Array.from({ length: 100 }, () => repository.consume(input)));

  assert.equal(decisions.filter((decision) => decision.allowed).length, 60);
  assert.equal(decisions.filter((decision) => !decision.allowed).length, 40);

  const reset = await repository.consume({ ...input, nowEpochMs: nowEpochMs + input.windowMs + 1 });
  assert.deepEqual(reset, { allowed: true, retryAfterSeconds: null });
});
