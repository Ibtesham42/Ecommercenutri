import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { aiProductSearch } from "@/lib/ai/search";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { SearchBox } from "@/components/storefront/search-box";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  path: "/search",
  noindex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim();

  const [search, wishlistIds] = await Promise.all([
    term
      ? aiProductSearch(term)
      : Promise.resolve({ products: [], interpreted: null, usedAI: false }),
    getWishlistProductIds(),
  ]);
  const { products, interpreted, usedAI } = search;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <SearchBox autoFocus />

      <Link
        href={term ? `/assistant?q=${encodeURIComponent(term)}` : "/assistant"}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Sparkles className="size-4" />
        Chat with the AI nutrition assistant
      </Link>

      <div className="mt-8">
        {term ? (
          products.length > 0 ? (
            <>
              {usedAI && interpreted ? (
                <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Showing results for: <span className="font-medium text-foreground">{interpreted}</span>
                </p>
              ) : (
                <p className="mb-5 text-sm text-muted-foreground">
                  {products.length} result{products.length === 1 ? "" : "s"} for “{term}”
                </p>
              )}
              <ProductGrid products={products} wishlistedIds={wishlistIds} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <p className="font-medium">No results for “{term}”</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different keyword, or browse{" "}
                <Link href="/products" className="text-primary hover:underline">
                  all products
                </Link>
                .
              </p>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Start typing to search our catalog.
          </p>
        )}
      </div>
    </div>
  );
}
