"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CatalogLink } from "@/components/storefront/catalog/catalog-transition";
import { cn } from "@/lib/utils";

const cell =
  "grid size-11 place-items-center rounded-lg text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export function PaginationBar({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const sp = useSearchParams();
  const pathname = usePathname();

  if (pageCount <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  }

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  const items: (number | "…")[] = [];
  let last = 0;
  for (const p of pages) {
    if (last && p - last > 1) items.push("…");
    items.push(p);
    last = p;
  }

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1 border-t border-border pt-8">
      {page > 1 ? (
        <CatalogLink href={hrefFor(page - 1)} className={cn(cell, "hover:bg-oat")} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </CatalogLink>
      ) : (
        <span aria-hidden className={cn(cell, "text-muted-foreground/40")}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <CatalogLink
            key={it}
            href={hrefFor(it)}
            aria-label={`Page ${it}`}
            aria-current={it === page ? "page" : undefined}
            className={cn(
              cell,
              it === page
                ? "bg-primary font-medium text-primary-foreground"
                : "text-foreground/75 hover:bg-oat hover:text-foreground",
            )}
          >
            {it}
          </CatalogLink>
        ),
      )}

      {page < pageCount ? (
        <CatalogLink href={hrefFor(page + 1)} className={cn(cell, "hover:bg-oat")} aria-label="Next page">
          <ChevronRight className="size-4" />
        </CatalogLink>
      ) : (
        <span aria-hidden className={cn(cell, "text-muted-foreground/40")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
