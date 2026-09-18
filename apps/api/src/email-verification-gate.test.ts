import "dotenv/config";
import { strict as assert } from "node:assert";
import { after, before, test } from "node:test";
import { closeDb, db, runMigrations, schema } from "@superlog/db";
import { eq } from "drizzle-orm";
import {
  EMAIL_VERIFICATION_GRANDFATHER_CUTOFF,
  isEmailVerificationExempt,
  isGrandfatheredUnverifiedUser,
} from "./email-verification-gate.js";

const orgIds: string[] = [];
const userIds: string[] = [];

before(async () => {
  await runMigrations();
});
after(async () => {
  try {
    for (const orgId of orgIds.reverse()) {
      await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
    }
    for (const userId of userIds.reverse()) {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  } finally {
    await closeDb();
  }
});

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function seedUser() {
  const tag = uniq("evg-user");
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${tag}@example.com` })
    .returning();
  if (!user) throw new Error("seed user failed");
  userIds.push(user.id);
  return user;
}

async function seedOrg() {
  const tag = uniq("evg-org");
  const [org] = await db.insert(schema.orgs).values({ name: tag, slug: tag }).returning();
  if (!org) throw new Error("seed org failed");
  orgIds.push(org.id);
  return org;
}

test("GET /api/me is exempt, mutating and data routes are not", () => {
  assert.equal(isEmailVerificationExempt("GET", "/api/me"), true);
  assert.equal(isEmailVerificationExempt("POST", "/api/me/orgs"), false);
  assert.equal(isEmailVerificationExempt("GET", "/api/projects/p1/issues"), false);
  assert.equal(isEmailVerificationExempt("PATCH", "/api/projects/p1/incidents/i1"), false);
  assert.equal(isEmailVerificationExempt("GET", "/api/projects/p1/keys"), false);
});

test("user with no membership is not grandfathered", async () => {
  const user = await seedUser();
  assert.equal(await isGrandfatheredUnverifiedUser(user.id), false);
});

test("membership created before the cutoff is grandfathered", async () => {
  const user = await seedUser();
  const org = await seedOrg();
  await db.insert(schema.orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: "member",
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  assert.equal(await isGrandfatheredUnverifiedUser(user.id), true);
});

test("membership created after the cutoff is not grandfathered", async () => {
  const user = await seedUser();
  const org = await seedOrg();
  await db.insert(schema.orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: "member",
    createdAt: new Date(EMAIL_VERIFICATION_GRANDFATHER_CUTOFF.getTime() + 86_400_000),
  });
  assert.equal(await isGrandfatheredUnverifiedUser(user.id), false);
});
