import type { Metadata } from "next";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Shop all products",
  description:
    "Browse Nutriyet's full range of makhana, dry fruits, seeds, protein and wellness products.",
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

  const [result, categories, wishlistIds] = await Promise.all([
    getProducts({ category, q, sort, minPrice, maxPrice, page }),
    getCategories(),
    getWishlistProductIds(),
  ]);

  const activeCategory = categories.find((c) => c.slug === category);
  const heading = activeCategory ? activeCategory.name : q ? `Results for “${q}”` : "All products";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
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
            <div className="rounded-xl border border-dashed p-12 text-center">
              <p className="font-medium">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or search.
              </p>
            </div>
          )}
          <PaginationBar page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </div>
  );
}
