import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTH_CLIENT_IP_HEADER,
  authBehindTrustedProxy,
  requestWithAuthClientIp,
  resolveAuthClientIp,
} from "./auth-client-ip.js";

test("proxy trust is off unless the deployment explicitly sets true", () => {
  assert.equal(authBehindTrustedProxy(undefined), false);
  assert.equal(authBehindTrustedProxy("false"), false);
  assert.equal(authBehindTrustedProxy("1"), false);
  assert.equal(authBehindTrustedProxy("true"), true);
});

test("direct auth requests ignore caller-supplied forwarding headers", () => {
  assert.equal(
    resolveAuthClientIp({
      peerIp: "198.51.100.42",
      forwardedFor: "203.0.113.9",
      behindTrustedProxy: false,
    }),
    "198.51.100.42",
  );
});

test("trusted proxies identify the client from the final forwarded address", () => {
  assert.equal(
    resolveAuthClientIp({
      peerIp: "10.0.0.12",
      forwardedFor: "203.0.113.9, 198.51.100.42",
      behindTrustedProxy: true,
    }),
    "198.51.100.42",
  );
});

test("trusted proxy requests with malformed forwarding data fall back to the socket peer", () => {
  assert.equal(
    resolveAuthClientIp({
      peerIp: "10.0.0.12",
      forwardedFor: "203.0.113.9, not-an-ip",
      behindTrustedProxy: true,
    }),
    "10.0.0.12",
  );
});

test("the auth request replaces caller-supplied resolved-IP headers", () => {
  const request = new Request("https://api.example.com/api/auth/sign-in/email", {
    headers: { [AUTH_CLIENT_IP_HEADER]: "203.0.113.9" },
  });

  const sanitized = requestWithAuthClientIp(request, "198.51.100.42");

  assert.equal(sanitized.headers.get(AUTH_CLIENT_IP_HEADER), "198.51.100.42");
});

test("the auth request drops a caller-supplied resolved-IP header when no peer is available", () => {
  const request = new Request("https://api.example.com/api/auth/sign-in/email", {
    headers: { [AUTH_CLIENT_IP_HEADER]: "203.0.113.9" },
  });

  const sanitized = requestWithAuthClientIp(request, undefined);

  assert.equal(sanitized.headers.has(AUTH_CLIENT_IP_HEADER), false);
});

test("sanitizing the IP preserves an auth request's method and body", async () => {
  const request = new Request("https://api.example.com/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com" }),
  });

  const sanitized = requestWithAuthClientIp(request, "198.51.100.42");

  assert.equal(sanitized.method, "POST");
  assert.deepEqual(await sanitized.json(), { email: "person@example.com" });
});
