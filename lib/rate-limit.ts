import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

function makeLimiter(tokens: number, window: Window, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    analytics: false,
  });
}

/**
 * Named limiters. Each is `null` when Redis is not configured; `checkRateLimit`
 * then treats the request as allowed (no throttling in keyless mode).
 */
export const limiters = {
  auth: makeLimiter(5, "1 m", "rl:auth"),
  ai: makeLimiter(20, "1 m", "rl:ai"),
  checkout: makeLimiter(10, "1 m", "rl:checkout"),
  api: makeLimiter(60, "1 m", "rl:api"),
};

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  try {
    return await limiter.limit(identifier);
  } catch {
    // Fail open: never block a real user because the limiter is down.
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}
