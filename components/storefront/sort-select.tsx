"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogNav } from "@/components/storefront/catalog/catalog-transition";
import { catalogHref } from "@/lib/catalog-params";

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "best-sellers", label: "Best sellers" },
  { value: "rating", label: "Top rated" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
];

/** Search results have no `sort` param by default — they're in relevance order. */
const RELEVANCE = "relevance";

export function SortSelect({ relevanceDefault = false }: { relevanceDefault?: boolean }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const { navigate } = useCatalogNav();
  const current = sp.get("sort") ?? (relevanceDefault ? RELEVANCE : "newest");
  const options = relevanceDefault ? [{ value: RELEVANCE, label: "Relevance" }, ...sorts] : sorts;

  function onChange(value: string) {
    const query = Object.fromEntries(sp.entries());
    // "Relevance" is the absence of a sort param — never sent to the server.
    navigate(catalogHref(pathname, query, { sort: value === RELEVANCE ? undefined : value }));
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger aria-label="Sort products" className="w-[9.75rem] rounded-lg sm:w-[12rem] data-[size=default]:h-11 [@media(pointer:fine)]:data-[size=default]:h-10">
        <span className="text-muted-foreground max-sm:sr-only">Sort:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
