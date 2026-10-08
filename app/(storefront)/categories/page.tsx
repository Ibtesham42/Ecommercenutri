import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/queries/catalog";
import { buildMetadata } from "@/lib/seo";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { CatalogHeader } from "@/components/storefront/catalog/catalog-header";

// Catalog data lives in the database, so render at request time rather than
// prerendering at build — the DB is only reachable (and needed) at runtime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Shop by category",
  description: "Explore Nutriyet product categories.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="shop-container pt-5 pb-16 sm:pt-7 lg:pb-24">
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: "Categories" }]} />
      <div className="mt-6 sm:mt-8">
        <CatalogHeader eyebrow="Shop" title="Shop by category" description="Find exactly what your body craves." />
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:mt-12 lg:grid-cols-4" data-heat="categories">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat">
                {c.image && (
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <h2 className="mt-3 font-heading text-[17px] font-medium leading-snug text-foreground group-hover:text-primary sm:text-lg">
                {c.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c._count.products} {c._count.products === 1 ? "product" : "products"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
