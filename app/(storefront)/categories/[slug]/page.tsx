import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/queries/catalog";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { buildMetadata, breadcrumbSchema, itemListSchema, jsonLd } from "@/lib/seo";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
import { CatalogShell } from "@/components/storefront/catalog/catalog-shell";
import { CatalogHeader } from "@/components/storefront/catalog/catalog-header";
import { CATALOG_GRID_CLASS } from "@/lib/product-card";
import { toCatalogQuery } from "@/lib/catalog-params";

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
    <>
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
      <CatalogShell
        pathname={`/categories/${slug}`}
        query={toCatalogQuery(sp)}
        supports={{ category: false, price: true }}
        breadcrumb={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/products" },
          { name: category.name },
        ]}
        beforeHeader={<BannerStrip position="categoryTop" className="mt-6 px-0" />}
        header={
          <CatalogHeader
            eyebrow="Category"
            title={category.name}
            description={category.description}
            image={category.image ? { src: category.image, alt: category.name } : null}
            panel={!category.image}
          >
            {category.children.length > 0 && (
              <nav aria-label={`${category.name} subcategories`} className="mt-5">
                <ul className="flex flex-wrap gap-2">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/categories/${child.slug}`}
                        className="inline-flex h-11 items-center rounded-full border border-border bg-background px-4 text-[13px] text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground [@media(pointer:fine)]:h-9"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </CatalogHeader>
        }
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        perPage={result.perPage}
        empty={{
          title: `No ${category.name} products yet`,
          description: "Nothing is listed here right now — browse the full catalog instead.",
          action: { label: "Browse all products", href: "/products" },
        }}
      >
        <ProductGrid products={result.products} wishlistedIds={wishlistIds} className={CATALOG_GRID_CLASS} />
      </CatalogShell>
    </>
  );
}
