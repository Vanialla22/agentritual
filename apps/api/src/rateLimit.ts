import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * In-memory token-bucket rate limiter (Phase 4, backlog item 4).
 * No new dependency. Buckets are per (route key + identity) and live only
 * in this process — good enough for the single-instance API; a public
 * launch behind multiple instances would need a shared store.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Route key, e.g. "submissions:ip". Part of the bucket identity. */
  key: string;
  /** Max requests in the window. */
  capacity: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** How to identify the caller (IP, wallet, ...). */
  identity: (req: FastifyRequest) => string;
}

/** Token-bucket check. Returns {allowed, retryAfterSeconds}. */
export function checkRateLimit(opts: RateLimitOptions, req: FastifyRequest): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const id = `${opts.key}:${opts.identity(req)}`;
  const now = Date.now();
  // Bound memory: drop buckets idle for over an hour when the map grows.
  // (Hardening review H-4: without this, one bucket per distinct IP /
  // wallet accumulates forever in a long-lived process.)
  if (buckets.size > 5000) {
    const cutoff = now - 60 * 60_000;
    for (const [k, b] of buckets) {
      if (b.lastRefillMs < cutoff) buckets.delete(k);
    }
  }
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { lastRefillMs: now, tokens: opts.capacity };
    buckets.set(id, bucket);
  }
  const elapsedMs = now - bucket.lastRefillMs;
  if (elapsedMs > 0) {
    bucket.tokens = Math.min(
      opts.capacity,
      bucket.tokens + (elapsedMs / opts.windowMs) * opts.capacity,
    );
    bucket.lastRefillMs = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const deficit = 1 - bucket.tokens;
  const retryAfterSeconds = Math.ceil(
    (deficit / opts.capacity) * (opts.windowMs / 1000),
  );
  return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
}

/** Pre-handler wrapper: 429 with Retry-After + JSON error on excess. */
export function rateLimit(opts: RateLimitOptions) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const result = checkRateLimit(opts, req);
    if (!result.allowed) {
      reply.header("Retry-After", String(result.retryAfterSeconds));
      return reply.status(429).send({
        error: `rate limit exceeded for ${opts.key} — try again in ${result.retryAfterSeconds}s`,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  };
}

export function clientIp(req: FastifyRequest): string {
  return req.ip ?? "unknown";
}

/** Test-only helper: clears all buckets (used by the Phase 4 test run). */
export function resetRateLimits(): void {
  buckets.clear();
}
