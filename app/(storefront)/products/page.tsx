import type { Metadata } from "next";
import { getProducts, getBestSellers, type ProductSort } from "@/lib/queries/products";
import { getCategories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid, ProductRail } from "@/components/storefront/product-card";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { CatalogShell } from "@/components/storefront/catalog/catalog-shell";
import { CatalogHeader } from "@/components/storefront/catalog/catalog-header";
import { CATALOG_GRID_CLASS } from "@/lib/product-card";
import { toCatalogQuery } from "@/lib/catalog-params";
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
      <CatalogShell
        pathname="/products"
        query={toCatalogQuery(sp)}
        supports={{ category: true, price: true }}
        categories={categories}
        breadcrumb={
          activeCategory
            ? [{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: activeCategory.name }]
            : [{ name: "Home", href: "/" }, { name: "Shop" }]
        }
        header={
          <CatalogHeader
            eyebrow="Shop"
            title={heading}
            description={
              activeCategory
                ? activeCategory.description
                : q
                  ? null
                  : "Makhana, spices and traditional pantry staples — rooted in tradition, picked with care."
            }
          />
        }
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        perPage={result.perPage}
        empty={{
          title: "No products found",
          description: "Try a different search, or browse the full catalog.",
          action: { label: "Browse all products", href: "/products" },
        }}
        emptyExtra={
          fallbackProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-5 font-heading text-subheading">You might like</h2>
              <ProductRail products={fallbackProducts} wishlistedIds={wishlistIds} />
            </div>
          )
        }
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
