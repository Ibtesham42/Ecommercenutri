"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll-snap rail with hover-revealed prev/next arrows — the
 * desktop "catalog rail" affordance (mobile keeps its own natural-swipe rail,
 * untouched). Arrows self-hide at each scroll edge instead of always
 * rendering both, so they never look clickable when there's nowhere to go.
 * Native `scrollBy` smooth-scroll — no animation library.
 */
export function ProductRailScroller({
  children,
  className,
}: {
  children: ReactNode;
  /** Applied to the outer wrapper (e.g. `hidden md:block` to pair with a
   *  separate mobile rail) — kept off the scroll track itself so it never
   *  fights `.scroll-rail`'s own `display: flex` for cascade order. */
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={cn("group/rail relative", className)}>
      <div ref={trackRef} className="scroll-rail gap-4">
        {children}
      </div>
      {canLeft && (
        <button
          type="button"
          aria-label="Show previous products"
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 hidden size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-foreground shadow-elev-2 transition-colors hover:border-primary/40 hover:text-primary md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Show more products"
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 hidden size-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-foreground shadow-elev-2 transition-colors hover:border-primary/40 hover:text-primary md:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
