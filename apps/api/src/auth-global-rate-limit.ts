const GLOBAL_AUTH_WINDOW_MS = 60_000;
const GLOBAL_AUTH_MAX = 60;

export type AuthRateLimitConsumeInput = {
  key: string;
  max: number;
  windowMs: number;
  nowEpochMs: number;
};

export type AuthRateLimitConsumeResult = {
  allowed: boolean;
  retryAfterSeconds: number | null;
};

export type AuthRateLimitRepository = {
  consume(input: AuthRateLimitConsumeInput): Promise<AuthRateLimitConsumeResult>;
};

export async function enforceGlobalAuthRateLimit(
  repository: AuthRateLimitRepository,
  clientIp: string | undefined,
  nowEpochMs = Date.now(),
): Promise<Response | null> {
  const decision = await repository.consume({
    key: `auth:global:${clientIp ?? "no-client-ip"}`,
    max: GLOBAL_AUTH_MAX,
    windowMs: GLOBAL_AUTH_WINDOW_MS,
    nowEpochMs,
  });
  if (decision.allowed) return null;

  const retryAfter = String(decision.retryAfterSeconds ?? GLOBAL_AUTH_WINDOW_MS / 1000);
  return new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
    status: 429,
    statusText: "Too Many Requests",
    headers: {
      "content-type": "application/json",
      "retry-after": retryAfter,
      "x-retry-after": retryAfter,
    },
  });
}
