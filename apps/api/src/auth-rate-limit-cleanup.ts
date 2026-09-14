import { AUTH_RATE_LIMIT_RETENTION_MS } from "./auth-rate-limit.js";

const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

export type AuthRateLimitCleanupRepository = {
  deleteBefore(cutoffEpochMs: number): Promise<number>;
};

export function startAuthRateLimitCleanup(input: {
  repository: AuthRateLimitCleanupRepository;
  intervalMs?: number;
  now?: () => number;
  onError: (error: unknown) => void;
}): () => void {
  const cleanup = () => {
    const cutoff = (input.now?.() ?? Date.now()) - AUTH_RATE_LIMIT_RETENTION_MS;
    void input.repository.deleteBefore(cutoff).catch(input.onError);
  };

  cleanup();
  const interval = setInterval(cleanup, input.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}
