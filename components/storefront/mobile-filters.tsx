"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CatalogLink, useCatalogNav } from "@/components/storefront/catalog/catalog-transition";

/**
 * Filter drawer below `lg`. Each option applies immediately (it's the same URL
 * link as the sidebar) inside the catalog transition, so the drawer stays open
 * for several picks; the footer shows the live result count and closes it.
 * Radix returns focus to the Filters button on close.
 */
export function MobileFilters({
  activeCount,
  total,
  clearHref,
  children,
}: {
  activeCount: number;
  total: number;
  clearHref: string;
  /** The filter panel (server-rendered). */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { isPending } = useCatalogNav();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 gap-2 rounded-lg px-3.5 font-medium lg:hidden">
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <>
              <span aria-hidden className="text-muted-foreground">·</span>
              <span className="tabular-nums">{activeCount}</span>
              <span className="sr-only">active</span>
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=left]:w-full data-[side=left]:min-[36rem]:max-w-sm"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-5">
          <SheetTitle className="font-heading text-lg font-medium">Filters</SheetTitle>
          <SheetDescription className="sr-only">Results update as you choose.</SheetDescription>
          <div className="flex items-center">
            {activeCount > 0 && (
              <CatalogLink
                href={clearHref}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear all
              </CatalogLink>
            )}
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Close filters"
                className="grid size-11 place-items-center rounded-md text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        <div className="border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="h-12 w-full rounded-lg text-[15px]" onClick={() => setOpen(false)} aria-live="polite">
            {isPending ? "Updating…" : `Show ${total} ${total === 1 ? "product" : "products"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
