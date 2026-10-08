import type { Metadata } from "next";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { CatalogShell } from "@/components/storefront/catalog/catalog-shell";
import { CatalogHeader } from "@/components/storefront/catalog/catalog-header";
import { CATALOG_GRID_CLASS } from "@/lib/product-card";
import { toCatalogQuery } from "@/lib/catalog-params";
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
      <CatalogShell
        pathname="/new-arrivals"
        query={toCatalogQuery(sp)}
        supports={{ category: true, price: true }}
        categories={categories}
        breadcrumb={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: "New arrivals" }]}
        header={
          <CatalogHeader
            eyebrow="Just in"
            title="New arrivals"
            description="The newest additions to the Nutriyet catalog, added in the last 30 days."
          />
        }
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        perPage={result.perPage}
        empty={{
          title: "No new arrivals right now",
          description: "Check back soon — we're always adding fresh products.",
          action: { label: "Browse all products", href: "/products" },
        }}
      >
        <ProductGrid
          products={result.products}
          wishlistedIds={wishlistIds}
          priorityCount={2}
          className={CATALOG_GRID_CLASS}
        />
      </CatalogShell>
    </>
  );
}
