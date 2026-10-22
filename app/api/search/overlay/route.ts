import { NextResponse } from "next/server";
import { getTopSearches } from "@/lib/queries/insights";
import { bestSellers } from "@/lib/recommendations/service";
import { getCategories } from "@/lib/queries/catalog";
import { minVariantPrice } from "@/lib/queries/products";
import { formatPrice } from "@/lib/format";
import { POPULAR_SEARCHES } from "@/lib/search-defaults";

export const dynamic = "force-dynamic";

/**
 * Discovery data for the mobile search overlay, fetched lazily once per
 * session (the client caches it) and CDN-cached for 5 minutes:
 *   - trending: live top search queries (UserEvent SEARCH), falling back to
 *     the shared default list when analytics are empty. Admin-managed trending
 *     terms are a future backlog item.
 *   - popular:  best-selling products (id/name/slug/image/price/rating).
 *   - categories: active category chips.
 */
export async function GET() {
  try {
    const [topSearches, popularProducts, categories] = await Promise.all([
      getTopSearches(14, 8).catch(() => []),
      bestSellers(6).catch(() => []),
      getCategories().catch(() => []),
    ]);

    const trending = topSearches.length > 0 ? topSearches.map((t) => t.query) : POPULAR_SEARCHES;

    const popular = popularProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.images[0]?.url ?? null,
      price: formatPrice(minVariantPrice(p.variants) ?? 0),
      rating: p.ratingAvg,
      ratingCount: p.ratingCount,
    }));

    const chips = categories
      .filter((c) => c._count.products > 0)
      .slice(0, 8)
      .map((c) => ({ name: c.name, slug: c.slug }));

    return NextResponse.json(
      { trending, popular, categories: chips },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
    );
  } catch (err) {
    console.error("[search/overlay] failed:", err);
    return NextResponse.json({ trending: POPULAR_SEARCHES, popular: [], categories: [] });
  }
}
