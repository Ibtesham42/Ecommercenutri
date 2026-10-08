import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, TrendingUp } from "lucide-react";
import { aiProductSearch } from "@/lib/ai/search";
import { getBestSellers, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid, ProductRail } from "@/components/storefront/product-card";
import { SearchBox } from "@/components/storefront/search-box";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
import { CatalogShell } from "@/components/storefront/catalog/catalog-shell";
import { CatalogHeader } from "@/components/storefront/catalog/catalog-header";
import { CATALOG_GRID_CLASS } from "@/lib/product-card";
import { toCatalogQuery } from "@/lib/catalog-params";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  path: "/search",
  noindex: true,
});

// Kept to terms that actually return results in the live catalog — verified
// against real product/category data, not assumed. Re-check if the catalog's
// category mix shifts meaningfully (e.g. new categories added/removed).
const POPULAR = [
  "Makhana",
  "Flavoured makhana",
  "Peri Peri Makhana",
  "Spices",
  "Red Chilli Powder",
  "Moringa",
  "Multigrain Flour",
];

const pill =
  "inline-flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground [@media(pointer:fine)]:h-9";

function SearchTools({ term }: { term: string }) {
  return (
    <div className="mt-6 max-w-2xl">
      <SearchBox autoFocus={!term} />
      <Link
        href={term ? `/assistant?q=${encodeURIComponent(term)}` : "/assistant"}
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <Sparkles className="size-4" />
        Not sure? Ask the AI nutrition assistant
      </Link>
    </div>
  );
}

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

  // Only fetched on a genuine zero-result search — richer no-results recovery
  // (popular products + browsable categories) instead of a dead end.
  const [fallbackProducts, fallbackCategories] =
    term && total === 0
      ? await Promise.all([getBestSellers(6), getCategories()])
      : [[], []];

  if (!term) {
    return (
      <div className="shop-container pt-5 pb-16 sm:pt-7 lg:pb-24">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Search" }]} />
        <div className="mt-6 sm:mt-8">
          <CatalogHeader
            eyebrow="Search"
            title="Search"
            description="Find makhana, spices and more from the Nutriyet pantry — rooted in tradition, picked with care."
          >
            <SearchTools term="" />
          </CatalogHeader>
        </div>
        <section className="mt-10 max-w-2xl" aria-labelledby="popular-searches">
          <h2 id="popular-searches" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <TrendingUp aria-hidden className="size-3.5 text-primary" /> Popular searches
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {POPULAR.map((p) => (
              <li key={p}>
                <Link href={`/search?q=${encodeURIComponent(p)}`} className={pill}>
                  {p}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <>
      <BehaviorTracker event={{ type: "SEARCH", query: term }} />
      <CatalogShell
        pathname="/search"
        query={toCatalogQuery(sp)}
        // aiProductSearch has no category/price refinements — don't offer filters it would ignore.
        supports={{ category: false, price: false }}
        breadcrumb={[{ name: "Home", href: "/" }, { name: "Search" }]}
        header={
          <CatalogHeader eyebrow="Search" title={`Results for “${term}”`}>
            {usedAI && interpreted ? (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Showing results for: <span className="font-medium text-foreground">{interpreted}</span>
                </span>
              </p>
            ) : null}
            <SearchTools term={term} />
          </CatalogHeader>
        }
        total={total}
        page={search.page}
        pageCount={pageCount}
        relevanceSort
        empty={{
          title: `No results for “${term}”`,
          description: "Try a different keyword or browse our full catalog.",
          action: { label: "Browse all products", href: "/products" },
        }}
        emptyExtra={
          <div className="mt-12 space-y-12">
            {fallbackCategories.length > 0 && (
              <section aria-labelledby="browse-categories">
                <h2 id="browse-categories" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Browse categories
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {fallbackCategories.slice(0, 8).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/categories/${c.slug}`} className={pill}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {fallbackProducts.length > 0 && (
              <section>
                <h2 className="mb-5 font-heading text-subheading">Popular products</h2>
                <ProductRail products={fallbackProducts} wishlistedIds={wishlistIds} />
              </section>
            )}
          </div>
        }
      >
        <ProductGrid products={products} wishlistedIds={wishlistIds} priorityCount={2} className={CATALOG_GRID_CLASS} />
      </CatalogShell>
    </>
  );
}
