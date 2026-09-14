import { metrics } from "@opentelemetry/api";

const authRateLimitedCounter = metrics
  .getMeter("@superlog/api/auth")
  .createCounter("superlog.auth.rate_limited", {
    description: "Auth requests rejected by the server-side rate limiter.",
    unit: "1",
  });

const EXACT_RATE_LIMIT_ROUTES = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
  "/api/auth/forget-password",
  "/api/auth/request-password-reset",
  "/api/auth/send-verification-email",
]);

export function authRateLimitMetricRoute(route: string): string {
  if (EXACT_RATE_LIMIT_ROUTES.has(route)) return route;
  if (route.startsWith("/api/auth/sign-in/")) return "/api/auth/sign-in/*";
  if (route.startsWith("/api/auth/sign-up/")) return "/api/auth/sign-up/*";
  if (route.startsWith("/api/auth/change-password")) return "/api/auth/change-password*";
  if (route.startsWith("/api/auth/change-email")) return "/api/auth/change-email*";
  return "/api/auth/*";
}

export function authRateLimitMetricAttributes(route: string, environment: string) {
  return {
    "http.route": authRateLimitMetricRoute(route),
    "deployment.environment.name": environment,
  };
}

export function recordAuthRateLimited(route: string, environment: string): void {
  authRateLimitedCounter.add(1, authRateLimitMetricAttributes(route, environment));
}
