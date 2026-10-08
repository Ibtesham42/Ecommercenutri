import { Check, Star } from "lucide-react";
import { CatalogLink } from "@/components/storefront/catalog/catalog-transition";
import { cn } from "@/lib/utils";
import {
  PRICE_RANGES,
  RATING_OPTIONS,
  catalogHref,
  type CatalogQuery,
  type CatalogSupports,
} from "@/lib/catalog-params";

export type CategoryOption = {
  name: string;
  slug: string;
  _count: { products: number };
};

/**
 * Editorial filter panel shared by the desktop sidebar and the mobile drawer.
 * Every option is a real link that rewrites the URL (same params as always);
 * single-choice groups render a radio mark, toggles a checkbox mark. Picking
 * the active single-choice option again clears it.
 */
export function CatalogFilters({
  pathname,
  query,
  supports,
  categories = [],
}: {
  pathname: string;
  query: CatalogQuery;
  supports: CatalogSupports;
  /** Only on routes that filter by `?category=` (not category or search pages). */
  categories?: CategoryOption[];
}) {
  const href = (updates: Record<string, string | undefined>) => catalogHref(pathname, query, updates);
  const activeCategory = query.category ?? "";
  const activeMin = query.minPrice ?? "";
  const activeMax = query.maxPrice ?? "";

  return (
    <div className="divide-y divide-border">
      {supports.category && categories.length > 0 && (
        <FilterGroup title="Category">
          <FilterOption
            href={href({ category: undefined })}
            active={!activeCategory}
            mark="radio"
            label="All products"
          />
          {categories.map((c) => (
            <FilterOption
              key={c.slug}
              href={href({ category: c.slug })}
              active={activeCategory === c.slug}
              mark="radio"
              label={c.name}
              count={c._count.products}
            />
          ))}
        </FilterGroup>
      )}

      {supports.price && (
        <FilterGroup title="Price">
          {PRICE_RANGES.map((r) => {
            const active = activeMin === r.min && activeMax === r.max;
            return (
              <FilterOption
                key={r.label}
                href={href(
                  active
                    ? { minPrice: undefined, maxPrice: undefined }
                    : { minPrice: r.min || undefined, maxPrice: r.max || undefined },
                )}
                active={active}
                mark="radio"
                label={r.label}
              />
            );
          })}
        </FilterGroup>
      )}

      <FilterGroup title="Availability">
        <FilterOption
          href={href({ inStock: query.inStock === "1" ? undefined : "1" })}
          active={query.inStock === "1"}
          mark="check"
          label="In stock only"
        />
      </FilterGroup>

      <FilterGroup title="Offers">
        <FilterOption
          href={href({ onSale: query.onSale === "1" ? undefined : "1" })}
          active={query.onSale === "1"}
          mark="check"
          label="On sale"
        />
      </FilterGroup>

      <FilterGroup title="Rating">
        {RATING_OPTIONS.map((r) => {
          const active = query.minRating === String(r);
          return (
            <FilterOption
              key={r}
              href={href({ minRating: active ? undefined : String(r) })}
              active={active}
              mark="radio"
              label={
                <span className="inline-flex items-center gap-1">
                  {r}
                  <Star aria-hidden className="size-3.5 fill-gold text-gold" />
                  <span>&amp; up</span>
                </span>
              }
              srLabel={`${r} stars and up`}
            />
          );
        })}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function FilterOption({
  href,
  active,
  mark,
  label,
  srLabel,
  count,
}: {
  href: string;
  active: boolean;
  mark: "radio" | "check";
  label: React.ReactNode;
  srLabel?: string;
  count?: number;
}) {
  return (
    <li>
      <CatalogLink
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "group/opt flex min-h-11 items-center gap-3 rounded-md text-sm transition-colors [@media(pointer:fine)]:min-h-9",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "font-medium text-foreground" : "text-foreground/75 hover:text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center border transition-colors",
            mark === "radio" ? "rounded-full" : "rounded-[4px]",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground/30 group-hover/opt:border-foreground/60",
          )}
        >
          {active &&
            (mark === "radio" ? (
              <span className="size-1.5 rounded-full bg-primary-foreground" />
            ) : (
              <Check className="size-3" strokeWidth={3} />
            ))}
        </span>
        {srLabel ? (
          <>
            <span aria-hidden className="flex-1">{label}</span>
            <span className="sr-only">{srLabel}</span>
          </>
        ) : (
          <span className="flex-1">{label}</span>
        )}
        {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      </CatalogLink>
    </li>
  );
}
