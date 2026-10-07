import { cache } from "react";
import { unstable_cache } from "next/cache";

/**
 * Data-cache tags for storefront reads that are identical for every shopper
 * (store settings, nav categories, homepage content). Invalidation is
 * automatic: the Prisma client extension in `lib/prisma.ts` revalidates the
 * tags in `MODEL_TAGS` after any write to those models — so a new admin
 * action never has to remember to call revalidateTag.
 *
 * Deliberately NOT cached: anything stock/price-bearing (product lists,
 * variants, showcase prices) — those change on every order.
 */
export const CACHE_TAGS = {
  storeSettings: "store-settings",
  categories: "categories",
  home: "home",
} as const;

type Tag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Prisma model → tags to revalidate when it's written. */
export const MODEL_TAGS: Partial<Record<string, readonly Tag[]>> = {
  StoreSetting: [CACHE_TAGS.storeSettings],
  // Hero slides link by category/product slug, so slug edits refresh "home" too.
  Category: [CACHE_TAGS.categories, CACHE_TAGS.home],
  Product: [CACHE_TAGS.home],
  HeroSlide: [CACHE_TAGS.home],
  HomeSection: [CACHE_TAGS.home],
};

/** Safety net: even a missed invalidation self-heals within this window. */
export const CACHE_TTL_SECONDS = 300;

/**
 * `unstable_cache` with two guarantees the raw API doesn't give:
 * - Only successful reads are cached — callers keep their DB-error fallbacks
 *   OUTSIDE the cached fn, so a cold-start blip never pins config defaults
 *   into the cache for the whole TTL.
 * - Outside the Next runtime (tsx scripts, tests) it runs uncached instead of
 *   throwing "incrementalCache missing".
 *
 * Results are JSON-serialised: return no `Date`s (they come back as strings).
 */
export function cachedQuery<T>(fn: () => Promise<T>, key: string, tags: readonly Tag[]): () => Promise<T> {
  // Pass `fn` itself, never a wrapper: Next keys the entry on fn.toString(),
  // so a code change to the query yields a new key and a deploy can't serve a
  // stale shape from the (cross-deploy) data cache.
  const cached = unstable_cache(fn, [key], { tags: [...tags], revalidate: CACHE_TTL_SECONDS });
  // React cache(): unstable_cache doesn't dedupe concurrent misses, so right
  // after an invalidation every getter in one render would each hit the DB
  // (seen: 12 reads of the settings row in a single request). One per render.
  return cache(async () => {
    try {
      return await cached();
    } catch (err) {
      if (err instanceof Error && err.message.includes("incrementalCache missing")) return fn();
      throw err;
    }
  });
}
