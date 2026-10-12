import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { SPINS_PER_BROWSER_PER_DAY, SPINS_PER_IP_PER_DAY } from "@/lib/spin/limits";

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
  jnvAi: makeLimiter(20, "1 m", "rl:jnv-ai"),
  jnvCodeMentor: makeLimiter(20, "1 m", "rl:jnv-code-mentor"),
  checkout: makeLimiter(10, "1 m", "rl:checkout"),
  api: makeLimiter(60, "1 m", "rl:api"),
  reviewUpload: makeLimiter(20, "1 m", "rl:review-upload"),
  b2bUpload: makeLimiter(10, "1 m", "rl:b2b-upload"),
  // New anonymous Spin & Win spins (lib/spin/limits.ts): per IP, and per
  // browser — curbs prize-fishing by clearing cookies.
  spinIp: makeLimiter(SPINS_PER_IP_PER_DAY, "1 d", "rl:spin-ip"),
  spinBrowser: makeLimiter(SPINS_PER_BROWSER_PER_DAY, "1 d", "rl:spin-browser"),
  spinClaim: makeLimiter(10, "10 m", "rl:spin-claim"),
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
