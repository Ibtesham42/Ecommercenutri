"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BlurImage } from "@/components/storefront/blur-image";
import { useVariantSelection } from "@/components/storefront/variant-selection";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string | null };

/** Horizontal swipe-to-navigate for touch devices — a vertical gesture (page
 *  scroll) is left alone; only a clearly-horizontal drag past the threshold
 *  triggers prev/next. Shared by the inline gallery and the lightbox. */
function useSwipeNav(go: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        go(dx < 0 ? 1 : -1);
      }
    },
  };
}

/** Cursor-following magnify on the main image — desktop/mouse only (gated on
 *  hover+fine-pointer capability and prefers-reduced-motion), restrained to a
 *  single smooth transform, not a gimmicky separate loupe panel. */
function useHoverZoom() {
  const capable = useRef(false);
  useEffect(() => {
    capable.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  return {
    zoomed: origin !== null,
    origin,
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      if (!capable.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setOrigin({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    },
    onMouseLeave: () => setOrigin(null),
  };
}

export function ProductGallery({
  images,
  name,
  variantMedia,
}: {
  images: GalleryImage[];
  name: string;
  /** Per-variant photo sets — when the selected variant has photos, the whole
   *  gallery switches to them (falls back to the product gallery otherwise). */
  variantMedia?: { id: string; images: string[] }[];
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const selection = useVariantSelection();
  const variantShots =
    variantMedia?.find((v) => v.id === selection?.variantId)?.images ?? [];
  const shots: GalleryImage[] =
    variantShots.length > 0
      ? variantShots.map((url) => ({ url, alt: null }))
      : images;
  // Identity of the current image SET — keys the main image so a variant
  // switch replays the blur-up crossfade, and resets to the cover shot.
  const setKey = variantShots.length > 0 ? (selection?.variantId ?? "product") : "product";
  useEffect(() => setActive(0), [setKey]);

  const main = shots[active] ?? shots[0];
  const count = shots.length;

  const go = useCallback(
    (dir: 1 | -1) => setActive((i) => (i + dir + count) % count),
    [count],
  );
  const swipe = useSwipeNav(go);
  const hoverZoom = useHoverZoom();

  return (
    <div className="space-y-3">
      {/* Main image — click to open the full-screen lightbox; swipe on touch;
          cursor-follow magnify on hover-capable pointers. */}
      <button
        type="button"
        onClick={() => {
          if (!hoverZoom.zoomed) setOpen(true);
        }}
        aria-label="Open image gallery"
        className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border bg-accent/20 shadow-elev-1"
        {...swipe}
        onMouseMove={hoverZoom.onMouseMove}
        onMouseLeave={hoverZoom.onMouseLeave}
      >
        {main && (
          <BlurImage
            // Key on the image-set identity + active index so both thumbnail
            // switches AND variant switches remount the image and replay the
            // blur-up reveal — a soft focus-pull between shots instead of a
            // hard cut (reduced-motion gated in globals).
            key={`${setKey}-${active}`}
            src={main.url}
            alt={main.alt ?? name}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className={cn(
              "object-cover transition-transform duration-200 ease-out",
              hoverZoom.zoomed ? "scale-[2]" : "group-hover:scale-105 duration-500",
            )}
            style={hoverZoom.origin ? { transformOrigin: `${hoverZoom.origin.x}% ${hoverZoom.origin.y}%` } : undefined}
            priority
          />
        )}
        <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-background/80 text-foreground opacity-0 shadow-elev-1 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
          <Expand className="size-4" />
        </span>
      </button>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shots.map((img, i) => (
            <button
              key={`${setKey}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border transition",
                i === active
                  ? "ring-2 ring-primary ring-offset-2"
                  : "opacity-70 hover:opacity-100 hover:border-primary/40",
              )}
            >
              <BlurImage src={img.url} alt={img.alt ?? name} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={open}
        onOpenChange={setOpen}
        images={shots}
        name={name}
        active={active}
        setActive={setActive}
        go={go}
        count={count}
      />
    </div>
  );
}

function Lightbox({
  open,
  onOpenChange,
  images,
  name,
  active,
  setActive,
  go,
  count,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  images: GalleryImage[];
  name: string;
  active: number;
  setActive: (i: number) => void;
  go: (dir: 1 | -1) => void;
  count: number;
}) {
  const [zoomed, setZoomed] = useState(false);
  const current = images[active] ?? images[0];
  const swipe = useSwipeNav(go);

  // Reset zoom whenever the active image or open state changes.
  useEffect(() => setZoomed(false), [active, open]);

  // Arrow-key navigation while open (Escape is handled by the Dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-5xl gap-3 border-none bg-background/95 p-3 backdrop-blur sm:p-5"
      >
        <DialogTitle className="sr-only">{name} — image gallery</DialogTitle>

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-accent/20 sm:aspect-[4/3]">
          {current && (
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className={cn("relative size-full", zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in")}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              {...(!zoomed ? swipe : {})}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // Crossfade between shots on prev/next + thumbnail nav.
                key={active}
                src={current.url}
                alt={current.alt ?? name}
                className={cn(
                  "mx-auto h-full w-full object-contain transition-transform duration-300 motion-safe:animate-fade-in",
                  zoomed && "scale-[1.8] cursor-zoom-out",
                )}
              />
            </button>
          )}

          {!zoomed && (
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium shadow-elev-1 backdrop-blur">
              <ZoomIn className="size-3.5" /> Tap to zoom
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 shadow-elev-1 backdrop-blur transition hover:bg-background"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 shadow-elev-1 backdrop-blur transition hover:bg-background"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium shadow-elev-1 backdrop-blur">
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
                aria-label={`View image ${i + 1}`}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg border transition",
                  i === active ? "ring-2 ring-primary ring-offset-2" : "opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? name} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
