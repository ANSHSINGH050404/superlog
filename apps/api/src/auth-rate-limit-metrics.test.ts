import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authRateLimitMetricAttributes,
  authRateLimitMetricRoute,
} from "./auth-rate-limit-metrics.js";

test("rate-limit metrics contain only the stable auth route and environment", () => {
  assert.deepEqual(authRateLimitMetricAttributes("/api/auth/sign-in/email", "production"), {
    "http.route": "/api/auth/sign-in/email",
    "deployment.environment.name": "production",
  });
});

test("rate-limit metric routes have bounded cardinality", () => {
  assert.equal(authRateLimitMetricRoute("/api/auth/sign-in/email"), "/api/auth/sign-in/email");
  assert.equal(
    authRateLimitMetricRoute("/api/auth/sign-in/attacker-chosen-provider"),
    "/api/auth/sign-in/*",
  );
  assert.equal(authRateLimitMetricRoute("/api/auth/attacker-chosen-path"), "/api/auth/*");
});
