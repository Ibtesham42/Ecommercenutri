import { NextResponse } from "next/server";
import { searchProducts, minVariantPrice } from "@/lib/queries/products";
import { searchCategories } from "@/lib/queries/catalog";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Lightweight suggestions for the header typeahead + mobile search overlay.
 * Response shape (additive — existing consumers read only `suggestions` and
 * ignore the extra fields):
 *   {
 *     suggestions: [{ id, name, slug, category, image, price, rating, ratingCount }],
 *     categories:  [{ name, slug }],
 *     keywords:    string[]
 *   }
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [], categories: [], keywords: [] });

  try {
    const [products, categories] = await Promise.all([
      searchProducts(q, 6),
      searchCategories(q, 3),
    ]);
    const suggestions = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category.name,
      image: p.images[0]?.url ?? null,
      price: formatPrice(minVariantPrice(p.variants) ?? 0),
      rating: p.ratingAvg,
      ratingCount: p.ratingCount,
    }));

    // Related keywords — derived from the results already in hand (no extra DB
    // cost): distinct matched product/category names that extend the query.
    const ql = q.toLowerCase();
    const keywords: string[] = [];
    const seen = new Set<string>([ql]);
    for (const name of [
      ...products.map((p) => p.category.name),
      ...products.map((p) => p.name),
    ]) {
      const k = name.trim();
      const kl = k.toLowerCase();
      if (!seen.has(kl) && kl.includes(ql) && kl !== ql) {
        seen.add(kl);
        keywords.push(k);
        if (keywords.length >= 4) break;
      }
    }

    return NextResponse.json({ suggestions, categories, keywords });
  } catch {
    return NextResponse.json({ suggestions: [], categories: [], keywords: [] });
  }
}
