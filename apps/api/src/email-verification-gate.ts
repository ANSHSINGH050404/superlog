import { db, schema } from "@superlog/db";
import { and, eq, lt } from "drizzle-orm";

// Email-verification enforcement (B-01 fix). A session whose address is not
// verified may only reach the verification-completion surface (GET /api/me so
// the client can render state + the verify banner; the actual verify/resend
// endpoints live under /api/auth/*, which bypasses the session middleware).
// All other /api/* routes require a verified address, closing the
// invite-accept + full-API-access path for unverified accounts.
//
// Grandfathering: memberships created before the cutoff keep working without
// verification so the rollout doesn't lock out pre-existing unverified users.
// Set EMAIL_VERIFICATION_GRANDFATHER_CUTOFF_ISO to the production deploy time;
// anyone who joins after it must verify. The DB check only runs for
// unverified sessions, so verified traffic pays no extra query.
export const EMAIL_VERIFICATION_GRANDFATHER_CUTOFF = new Date(
  process.env.EMAIL_VERIFICATION_GRANDFATHER_CUTOFF_ISO ?? "2026-09-18T00:00:00.000Z",
);

export const EMAIL_VERIFICATION_ALLOWLIST = new Set(["GET /api/me"]);

export function isEmailVerificationExempt(method: string, path: string): boolean {
  return EMAIL_VERIFICATION_ALLOWLIST.has(`${method} ${path}`);
}

export async function isGrandfatheredUnverifiedUser(userId: string): Promise<boolean> {
  const legacyMembership = await db.query.orgMembers.findFirst({
    where: and(
      eq(schema.orgMembers.userId, userId),
      lt(schema.orgMembers.createdAt, EMAIL_VERIFICATION_GRANDFATHER_CUTOFF),
    ),
    columns: { id: true },
  });
  return !!legacyMembership;
}
