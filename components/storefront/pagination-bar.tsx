"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <nav className="mt-10 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="grid size-10 place-items-center rounded-xl border transition-colors hover:border-primary/40 hover:bg-accent"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className="grid size-10 place-items-center rounded-xl border opacity-40">
          <ChevronLeft className="size-4" />
        </span>
      )}

      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={it}
            href={hrefFor(it)}
            className={cn(
              "grid size-10 place-items-center rounded-xl border text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent",
              it === page &&
                "border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary",
            )}
          >
            {it}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          className="grid size-10 place-items-center rounded-xl border transition-colors hover:border-primary/40 hover:bg-accent"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="grid size-10 place-items-center rounded-xl border opacity-40">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
