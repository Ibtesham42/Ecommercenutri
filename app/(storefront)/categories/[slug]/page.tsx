import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/queries/catalog";
import { getProducts, type ProductSort } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";

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

  const page = Number(typeof sp.page === "string" ? sp.page : "") || 1;
  const sort = ((typeof sp.sort === "string" ? sp.sort : "newest") as ProductSort);

  const [result, wishlistIds] = await Promise.all([
    getProducts({ category: slug, sort, page }),
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
      <header className="mb-6 rounded-2xl bg-gradient-to-r from-accent/50 to-secondary p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
        {category.description && (
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {category.description}
          </p>
        )}
      </header>

      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
        <span className="text-sm text-muted-foreground">
          {result.total} {result.total === 1 ? "product" : "products"}
        </span>
        <SortSelect />
      </div>

      {result.products.length > 0 ? (
        <ProductGrid products={result.products} wishlistedIds={wishlistIds} />
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">No products in this category yet.</p>
        </div>
      )}
      <PaginationBar page={result.page} pageCount={result.pageCount} />
    </div>
  );
}
