import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { getCategoryBySlug } from "@/lib/queries/catalog";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { EmptyState } from "@/components/storefront/empty-state";
import { BlurImage } from "@/components/storefront/blur-image";
import { buildMetadata, breadcrumbSchema, itemListSchema, jsonLd } from "@/lib/seo";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return buildMetadata({
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    path: `/categories/${slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) notFound();

  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Number(get("page")) || 1;
  const sort = (get("sort") ?? "newest") as ProductSort;
  const minPrice = get("minPrice") ? Number(get("minPrice")) : undefined;
  const maxPrice = get("maxPrice") ? Number(get("maxPrice")) : undefined;
  const onSale = get("onSale") === "1";
  const inStock = get("inStock") === "1";
  const minRating = get("minRating") ? Number(get("minRating")) : undefined;

  const [result, wishlistIds] = await Promise.all([
    getProducts({ category: slug, sort, minPrice, maxPrice, onSale, inStock, minRating, page }),
    getWishlistProductIds(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Categories", path: "/categories" },
            { name: category.name, path: `/categories/${slug}` },
          ]),
        )}
      />
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
              category.name,
            ),
          )}
        />
      )}
      <BehaviorTracker event={{ type: "CATEGORY_VIEW", categoryId: category.id }} />
      <BannerStrip position="categoryTop" className="mb-6 px-0" />

      {category.image ? (
        <header className="relative mb-6 overflow-hidden rounded-2xl">
          <div className="relative aspect-[21/9] w-full sm:aspect-[3/1]">
            <BlurImage
              src={category.image}
              alt={category.name}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-white drop-shadow sm:text-3xl">
              {category.name}
            </h1>
            {category.description && (
              <p className="mt-1.5 max-w-2xl text-sm text-white/85 drop-shadow sm:text-base">
                {category.description}
              </p>
            )}
          </div>
        </header>
      ) : (
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-accent/50 to-secondary p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
          {category.description && (
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {category.description}
            </p>
          )}
        </header>
      )}

      {category.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/categories/${child.slug}`}
              className={cn(
                "rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors",
                "text-foreground/75 hover:border-primary/30 hover:text-primary",
              )}
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <MobileFilters hideCategoryList />
          <span className="text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "product" : "products"}
          </span>
        </div>
        <SortSelect />
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <CatalogFilters hideCategoryList />
        </aside>

        <div>
          {result.products.length > 0 ? (
            <ProductGrid products={result.products} wishlistedIds={wishlistIds} />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No products found"
              description="Try adjusting your filters, or browse the full catalog instead."
              action={{ label: "Clear filters", href: `/categories/${slug}` }}
            />
          )}
          <PaginationBar page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </div>
  );
}
