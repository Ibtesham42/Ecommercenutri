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
  // Per-IP ceiling for analytics beacons. Deliberately loose: Indian mobile
  // carriers put many shoppers behind one CGNAT address.
  analyticsIp: makeLimiter(600, "1 m", "rl:analytics-ip"),
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

/**
 * Analytics beacons are keyed by a client-supplied id (nut_cid / nut_anon), which
 * a script can rotate on every request. Also bound them by the client IP. The
 * site is served directly by Vercel (no proxy in front), whose edge OVERWRITES
 * `x-forwarded-for` with the connecting IP — a client-sent value never reaches
 * us — so its first entry is server-controlled. (Same source every other
 * limiter here uses.) Both limits must pass.
 */
export async function checkAnalyticsRateLimit(
  req: Request,
  scope: string,
  clientKey: string,
): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "anon";
  const [byIp, byClient] = await Promise.all([
    checkRateLimit(limiters.analyticsIp, `${scope}:${ip}`),
    checkRateLimit(limiters.api, `${scope}:${clientKey}`),
  ]);
  return byIp.success && byClient.success;
}
