import { Redis } from "@upstash/redis";
import { env, isConfigured } from "@/lib/env";

/**
 * Upstash Redis client. `null` when not configured — all cache helpers below
 * then degrade to no-ops so the app keeps working (just uncached).
 */
export const redis = isConfigured.redis()
  ? new Redis({ url: env.upstashUrl, token: env.upstashToken })
  : null;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return (await redis.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  if (!redis) return;
  try {
    if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
    else await redis.set(key, value);
  } catch {
    /* ignore cache errors */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    /* ignore */
  }
}

/** Read-through cache wrapper. Falls back to calling `fn` directly if no Redis. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await fn();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
