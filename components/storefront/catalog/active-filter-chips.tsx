import { X } from "lucide-react";
import { CatalogLink } from "@/components/storefront/catalog/catalog-transition";
import { cn } from "@/lib/utils";
import type { ActiveFilter } from "@/lib/catalog-params";

/** One removable chip per applied filter, plus "Clear all" (keeps the search term). */
export function ActiveFilterChips({
  filters,
  clearHref,
  className,
}: {
  filters: ActiveFilter[];
  clearHref: string;
  className?: string;
}) {
  if (filters.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="sr-only">Active filters:</span>
      <ul className="contents">
        {filters.map((f) => (
          <li key={f.key}>
            <CatalogLink
              href={f.removeHref}
              aria-label={`Remove filter: ${f.label}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background pr-3 pl-3.5 text-[13px] text-foreground outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:fine)]:h-8"
            >
              {f.label}
              <X aria-hidden className="size-3.5 text-muted-foreground" />
            </CatalogLink>
          </li>
        ))}
      </ul>
      <CatalogLink
        href={clearHref}
        className="inline-flex h-11 items-center rounded-md px-2 text-[13px] text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:fine)]:h-8"
      >
        Clear all
      </CatalogLink>
    </div>
  );
}
