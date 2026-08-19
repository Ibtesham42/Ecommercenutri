"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Full-screen viewer for review photos. Visually modeled on
 * `product-gallery.tsx`'s Lightbox (same Dialog styling, zoom toggle, arrow
 * nav, counter) but self-contained — deliberately not shared code, so this
 * feature can never regress the product gallery.
 */
export function ReviewPhotoLightbox({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  title = "Review photos",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}) {
  const [active, setActive] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (open) setActive(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => setZoomed(false), [active, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % count);
      else if (e.key === "ArrowLeft") setActive((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  const current = images[active];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-5xl gap-3 border-none bg-background/95 p-3 backdrop-blur sm:p-5"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-accent/20 sm:aspect-[4/3]">
          {current && (
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className={cn("relative size-full", zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in")}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={active}
                src={current}
                alt={`${title} ${active + 1} of ${count}`}
                className={cn(
                  "mx-auto h-full w-full object-contain transition-transform duration-300 motion-safe:animate-fade-in",
                  zoomed && "scale-[1.8] cursor-zoom-out",
                )}
              />
            </button>
          )}

          {!zoomed && (
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              <ZoomIn className="size-3.5" /> Tap to zoom
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActive((i) => (i - 1 + count) % count)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur transition hover:bg-background"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setActive((i) => (i + 1) % count)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur transition hover:bg-background"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
                {active + 1} / {count}
              </span>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View photo ${i + 1}`}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg border transition",
                  i === active ? "ring-2 ring-primary ring-offset-2" : "opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Thumbnail ${i + 1}`} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
