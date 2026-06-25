import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/queries/catalog";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Shop by category",
  description: "Explore Nutriyet product categories.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Shop by category</h1>
        <p className="mt-1 text-muted-foreground">
          Find exactly what your body craves.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            className="group relative overflow-hidden rounded-2xl border"
          >
            <div className="relative aspect-[4/3] bg-accent/30">
              {c.image && (
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4 text-white">
                <h2 className="font-heading text-lg font-bold">{c.name}</h2>
                <p className="text-xs text-white/80">
                  {c._count.products}{" "}
                  {c._count.products === 1 ? "product" : "products"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
