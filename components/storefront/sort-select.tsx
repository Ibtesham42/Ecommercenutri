"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "best-sellers", label: "Best sellers" },
  { value: "rating", label: "Top rated" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
];

export function SortSelect() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = sp.get("sort") ?? "newest";

  function onChange(value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-[150px] rounded-xl sm:w-[180px]">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {sorts.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
