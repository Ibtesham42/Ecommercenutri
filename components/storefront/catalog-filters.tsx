"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type CategoryOption = {
  name: string;
  slug: string;
  _count: { products: number };
};

const priceRanges = [
  { label: "Under ₹200", min: "", max: "200" },
  { label: "₹200 – ₹500", min: "200", max: "500" },
  { label: "₹500 – ₹1000", min: "500", max: "1000" },
  { label: "Over ₹1000", min: "1000", max: "" },
];

export function CatalogFilters({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const sp = useSearchParams();
  const pathname = usePathname();

  function buildHref(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const activeCategory = sp.get("category") ?? "";
  const activeMin = sp.get("minPrice") ?? "";
  const activeMax = sp.get("maxPrice") ?? "";
  const hasFilters = Boolean(activeCategory || activeMin || activeMax || sp.get("q"));

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Filters</h3>
          {hasFilters && (
            <Link
              href={pathname}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Clear all
            </Link>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Category
        </h4>
        <ul className="space-y-1">
          <li>
            <Link
              href={buildHref({ category: undefined })}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                !activeCategory && "bg-accent font-medium text-primary",
              )}
            >
              All products
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={buildHref({ category: c.slug })}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  activeCategory === c.slug && "bg-accent font-medium text-primary",
                )}
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c._count.products}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Price
        </h4>
        <ul className="space-y-1">
          {priceRanges.map((r) => {
            const isActive = activeMin === r.min && activeMax === r.max;
            return (
              <li key={r.label}>
                <Link
                  href={buildHref({
                    minPrice: r.min || undefined,
                    maxPrice: r.max || undefined,
                  })}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    isActive && "bg-accent font-medium text-primary",
                  )}
                >
                  {r.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
