import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { EmptyState } from "@/components/storefront/empty-state";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { buildMetadata, itemListSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "New Arrivals",
  description: "The newest additions to the Nutriyet catalog.",
  path: "/new-arrivals",
});

export default async function NewArrivalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const page = Number(get("page")) || 1;
  const category = get("category");
  const sort = (get("sort") ?? "newest") as ProductSort;
  const minPrice = get("minPrice") ? Number(get("minPrice")) : undefined;
  const maxPrice = get("maxPrice") ? Number(get("maxPrice")) : undefined;
  const onSale = get("onSale") === "1";
  const inStock = get("inStock") === "1";
  const minRating = get("minRating") ? Number(get("minRating")) : undefined;

  const [result, categories, wishlistIds] = await Promise.all([
    getProducts({
      category,
      sort,
      minPrice,
      maxPrice,
      onSale,
      inStock,
      minRating,
      page,
      newOnly: true,
    }),
    getCategories(),
    getWishlistProductIds(),
  ]);

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
              "New Arrivals",
            ),
          )}
        />
      )}
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "New Arrivals" }]} />
        <header className="mb-6 mt-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">New Arrivals</h1>
          <p className="mt-1 text-muted-foreground">
            The newest additions to the Nutriyet catalog, added in the last 30 days.
          </p>
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
              <ProductGrid products={result.products} wishlistedIds={wishlistIds} priorityCount={2} />
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No new arrivals right now"
                description="Check back soon — we're always adding fresh products."
                action={{ label: "Browse all products", href: "/products" }}
              />
            )}
            <PaginationBar page={result.page} pageCount={result.pageCount} />
          </div>
        </div>
      </div>
    </>
  );
}
