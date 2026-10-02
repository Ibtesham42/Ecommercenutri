"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
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
  categories = [],
  hideCategoryList = false,
}: {
  categories?: CategoryOption[];
  /** Skip the "Category" section — used on an already category-scoped page
   *  (`/categories/[slug]`), where that list would conflict with the route. */
  hideCategoryList?: boolean;
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
  const activeOnSale = sp.get("onSale") === "1";
  const activeInStock = sp.get("inStock") === "1";
  const activeRating = sp.get("minRating") ?? "";
  const hasFilters = Boolean(
    activeCategory || activeMin || activeMax || activeOnSale || activeInStock || activeRating || sp.get("q"),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">Filters</h3>
        {hasFilters && (
          <Link
            href={pathname}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Clear all
          </Link>
        )}
      </div>

      {!hideCategoryList && (
      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </h4>
        <ul className="space-y-1">
          <li>
            <Link
              href={buildHref({ category: undefined })}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                !activeCategory && "bg-primary/10 font-semibold text-primary",
              )}
            >
              All products
            </Link>
          </li>
          {categories.map((c) => {
            const isActive = activeCategory === c.slug;
            return (
              <li key={c.slug}>
                <Link
                  href={buildHref({ category: c.slug })}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                    isActive && "bg-primary/10 font-semibold text-primary",
                  )}
                >
                  <span>{c.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c._count.products}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      )}

      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Price
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {priceRanges.map((r) => {
            const isActive = activeMin === r.min && activeMax === r.max;
            return (
              <Link
                key={r.label}
                href={buildHref({
                  minPrice: r.min || undefined,
                  maxPrice: r.max || undefined,
                })}
                className={cn(
                  "rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:border-primary/40 hover:bg-accent",
                )}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Availability
        </h4>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref({ onSale: activeOnSale ? undefined : "1" })}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
              activeOnSale
                ? "border-primary bg-primary/5 text-primary"
                : "hover:border-primary/40 hover:bg-accent",
            )}
          >
            On sale
          </Link>
          <Link
            href={buildHref({ inStock: activeInStock ? undefined : "1" })}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
              activeInStock
                ? "border-primary bg-primary/5 text-primary"
                : "hover:border-primary/40 hover:bg-accent",
            )}
          >
            In stock only
          </Link>
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating
        </h4>
        <div className="flex flex-wrap gap-2">
          {[4, 3].map((r) => (
            <Link
              key={r}
              href={buildHref({ minRating: activeRating === String(r) ? undefined : String(r) })}
              className={cn(
                "flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                activeRating === String(r)
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:border-primary/40 hover:bg-accent",
              )}
            >
              {r}
              <Star className="size-3 fill-current" />
              & up
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
