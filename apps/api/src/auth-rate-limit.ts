import type { BetterAuthOptions } from "better-auth";

const FIFTEEN_MINUTES_SECONDS = 15 * 60;
const ONE_HOUR_SECONDS = 60 * 60;
export const AUTH_RATE_LIMIT_RETENTION_MS = ONE_HOUR_SECONDS * 1000;

export const AUTH_RATE_LIMIT = {
  enabled: true,
  storage: "database",
  // Better Auth uses the base window as its database-pruning horizon. Keep it
  // at least as long as the longest custom rule. A separate pre-handler guard
  // applies the aggregate per-IP limit across every auth route.
  window: ONE_HOUR_SECONDS,
  max: 60,
  customRules: {
    "/sign-in/email": { window: FIFTEEN_MINUTES_SECONDS, max: 5 },
    "/sign-up/email": { window: ONE_HOUR_SECONDS, max: 5 },
    "/forget-password": { window: ONE_HOUR_SECONDS, max: 3 },
    "/request-password-reset": { window: ONE_HOUR_SECONDS, max: 3 },
    "/send-verification-email": { window: ONE_HOUR_SECONDS, max: 3 },
    // Preserve Better Auth's stricter built-in limits for any present or
    // future credential endpoints before the catch-all rule is considered.
    "/sign-in/*": { window: 10, max: 3 },
    "/sign-up/*": { window: 10, max: 3 },
    "/change-password*": { window: 10, max: 3 },
    "/change-email*": { window: 10, max: 3 },
    "*": false,
  },
} satisfies NonNullable<BetterAuthOptions["rateLimit"]>;
