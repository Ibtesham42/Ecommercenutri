"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CatalogFilters } from "@/components/storefront/catalog-filters";

type CategoryOption = {
  name: string;
  slug: string;
  _count: { products: number };
};

export function MobileFilters({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 lg:hidden">
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-80 flex-col p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Filter products</SheetTitle>
        </SheetHeader>
        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          onClick={() => setOpen(false)}
        >
          <CatalogFilters categories={categories} />
        </div>
        <div className="border-t p-4">
          <Button className="h-11 w-full" onClick={() => setOpen(false)}>
            View results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
