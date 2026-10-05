import type { Metadata } from "next";
import { getProducts, getBestSellers, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { EmptyState } from "@/components/storefront/empty-state";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { ProductRail } from "@/components/storefront/product-card";
import { PackageSearch } from "lucide-react";
import { buildMetadata, itemListSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Shop all products",
  description:
    "Browse Nutriyet's full range of makhana, spices and traditional pantry staples — rooted in tradition, picked with care.",
  path: "/products",
});

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const page = Number(get("page")) || 1;
  const category = get("category");
  const q = get("q");
  const sort = (get("sort") ?? "newest") as ProductSort;
  const minPrice = get("minPrice") ? Number(get("minPrice")) : undefined;
  const maxPrice = get("maxPrice") ? Number(get("maxPrice")) : undefined;
  const onSale = get("onSale") === "1";
  const inStock = get("inStock") === "1";
  const minRating = get("minRating") ? Number(get("minRating")) : undefined;

  const [result, categories, wishlistIds] = await Promise.all([
    getProducts({ category, q, sort, minPrice, maxPrice, onSale, inStock, minRating, page }),
    getCategories(),
    getWishlistProductIds(),
  ]);
  // Only fetched when the result set is empty — a "you might like" fallback
  // rail instead of a dead-end "no products found" page.
  const fallbackProducts = result.products.length === 0 ? await getBestSellers(6) : [];

  const activeCategory = categories.find((c) => c.slug === category);
  const heading = activeCategory ? activeCategory.name : q ? `Results for “${q}”` : "All products";

  return (
    <>
      {result.products.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(
            itemListSchema(
              result.products.map((p) => ({
                name: p.name,
                path: `/products/${p.slug}`,
                image: p.images[0]?.url,
              })),
              heading,
            ),
          )}
        />
      )}
      <BannerStrip position="productsTop" className="pt-6" />
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <PageBreadcrumb
          items={
            activeCategory
              ? [
                  { name: "Home", href: "/" },
                  { name: "Products", href: "/products" },
                  { name: activeCategory.name },
                ]
              : [{ name: "Home", href: "/" }, { name: "Products" }]
          }
        />
        <header className="mb-6 mt-4">
          <span className="mb-3 block h-0.5 w-9 rounded-full bg-gold" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h1>
        {activeCategory?.description && (
          <p className="mt-1 text-muted-foreground">{activeCategory.description}</p>
        )}
      </header>

      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <MobileFilters categories={categories} />
          <span className="text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "product" : "products"}
          </span>
        </div>
        <SortSelect />
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <CatalogFilters categories={categories} />
        </aside>

        <div>
          {result.products.length > 0 ? (
            <ProductGrid products={result.products} wishlistedIds={wishlistIds} />
          ) : (
            <>
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                description="Try adjusting your filters or search to find what you're craving."
                action={{ label: "Clear filters", href: "/products" }}
              />
              {fallbackProducts.length > 0 && (
                <div className="mt-10">
                  <h2 className="mb-5 text-lg font-bold sm:text-xl">You might like</h2>
                  <ProductRail products={fallbackProducts} wishlistedIds={wishlistIds} />
                </div>
              )}
            </>
          )}
          <PaginationBar page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </div>
    </>
  );
}
