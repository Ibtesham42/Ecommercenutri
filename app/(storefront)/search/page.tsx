import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, SearchX, TrendingUp } from "lucide-react";
import { aiProductSearch } from "@/lib/ai/search";
import type { ProductSort } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { SearchBox } from "@/components/storefront/search-box";
import { SortSelect } from "@/components/storefront/sort-select";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { EmptyState } from "@/components/storefront/empty-state";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  path: "/search",
  noindex: true,
});

const POPULAR = [
  "Makhana",
  "Flavoured makhana",
  "Almonds",
  "Protein",
  "Seeds",
  "Dry fruits",
  "Healthy snacks",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const term = (get("q") ?? "").trim();
  const sort = get("sort") as ProductSort | undefined;
  const page = Number(get("page")) || 1;
  const onSale = get("onSale") === "1";
  const inStock = get("inStock") === "1";
  const minRating = get("minRating") ? Number(get("minRating")) : undefined;

  const [search, wishlistIds] = await Promise.all([
    term
      ? aiProductSearch(term, { sort, onSale, inStock, minRating, page })
      : Promise.resolve({
          products: [],
          interpreted: null,
          usedAI: false,
          total: 0,
          page: 1,
          pageCount: 1,
        }),
    getWishlistProductIds(),
  ]);
  const { products, interpreted, usedAI, total, pageCount } = search;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {term && <BehaviorTracker event={{ type: "SEARCH", query: term }} />}
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Search</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Find makhana, dry fruits, seeds, protein and more.
        </p>
        <SearchBox autoFocus />

        <Link
          href={term ? `/assistant?q=${encodeURIComponent(term)}` : "/assistant"}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Sparkles className="size-4" />
          Not sure? Ask the AI nutrition assistant
        </Link>
      </div>

      <div className="mt-8">
        {term ? (
          total > 0 ? (
            <>
              {usedAI && interpreted ? (
                <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Showing results for: <span className="font-medium text-foreground">{interpreted}</span>
                </p>
              ) : null}

              <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                  <MobileFilters hideCategoryList />
                  <span className="text-sm text-muted-foreground">
                    {total} result{total === 1 ? "" : "s"} for “{term}”
                  </span>
                </div>
                <SortSelect />
              </div>

              <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
                <aside className="hidden lg:block">
                  <CatalogFilters hideCategoryList />
                </aside>
                <div>
                  <ProductGrid products={products} wishlistedIds={wishlistIds} />
                  <PaginationBar page={search.page} pageCount={pageCount} />
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={SearchX}
              title={`No results for “${term}”`}
              description="Try a different keyword or browse our full catalog."
              action={{ label: "Browse all products", href: "/products" }}
            />
          )
        ) : (
          <div className="mx-auto max-w-4xl">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="size-3.5 text-primary" /> Popular searches
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <Link
                  key={p}
                  href={`/search?q=${encodeURIComponent(p)}`}
                  className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-elev-1 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
