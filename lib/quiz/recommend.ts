import "server-only";

import {
  searchProducts,
  getBestSellers,
  type ProductCardData,
} from "@/lib/queries/products";
import type { QuizFocus } from "@/lib/quiz/score";

/** A product is recommendable only if at least one active variant is in stock —
 *  the assessment must never surface an unavailable/out-of-stock product. */
function inStock(p: ProductCardData): boolean {
  return p.variants.some((v) => v.stock > 0);
}

function queryFromFocus(f: QuizFocus): string {
  // Focus links are storefront search URLs (e.g. /search?q=makhana); reuse the
  // same query the shopper would run so recs match real catalog results.
  const m = /[?&]q=([^&]+)/.exec(f.href);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : f.label;
}

/**
 * Maps a quiz result's focus tags to REAL, in-stock, goal-matched products so
 * the AI Assessment recommends actual catalog items (add-to-cart ready) instead
 * of bare search links. Reuses the existing storefront search (active-only,
 * rating-sorted); interleaves one product per focus for variety, dedupes, and
 * backfills with in-stock best-sellers so the strip is never sparse. Best-effort:
 * the caller treats a thrown error as "no recommendations".
 */
export async function getQuizRecommendedProducts(
  focus: QuizFocus[],
  limit = 4,
): Promise<ProductCardData[]> {
  const lists = await Promise.all(
    focus.slice(0, 3).map(async (f) => (await searchProducts(queryFromFocus(f), 6)).filter(inStock)),
  );

  const seen = new Set<string>();
  const out: ProductCardData[] = [];
  // Round-robin across focus areas so a goal with many matches doesn't crowd out
  // the others — a more useful, varied "picked for you" set.
  for (let round = 0; out.length < limit && round < 6; round++) {
    for (const list of lists) {
      const p = list[round];
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
        if (out.length >= limit) break;
      }
    }
  }

  if (out.length < limit) {
    for (const p of await getBestSellers(limit + 6)) {
      if (out.length >= limit) break;
      if (!seen.has(p.id) && inStock(p)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }

  return out.slice(0, limit);
}
