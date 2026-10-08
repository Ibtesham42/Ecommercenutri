"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BlurImage } from "@/components/storefront/blur-image";
import { useVariantSelection } from "@/components/storefront/variant-selection";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string | null };

/** Horizontal swipe-to-navigate for the lightbox — a vertical gesture is left
 *  alone; only a clearly-horizontal drag past the threshold triggers prev/next. */
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

/** Cursor-following magnify on the current image — mouse only (gated on
 *  hover + fine-pointer capability and prefers-reduced-motion). */
function useHoverZoom() {
  const capable = useRef(false);
  useEffect(() => {
    capable.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  return {
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
    reset: () => setOrigin(null),
  };
}

/**
 * Product gallery. One scroll-snap track at every width (so there's a single
 * priority/LCP image): swipeable with dots on mobile; on md+ the track is
 * driven by thumbnails and magnifies under the cursor. Images sit whole
 * (object-contain) on an oat tile, never cropped. Any image opens the lightbox.
 */
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
  const trackRef = useRef<HTMLDivElement>(null);

  const selection = useVariantSelection();
  const variantShots =
    variantMedia?.find((v) => v.id === selection?.variantId)?.images ?? [];
  const shots: GalleryImage[] =
    variantShots.length > 0
      ? variantShots.map((url) => ({ url, alt: null }))
      : images;
  // Identity of the current image SET — a variant switch resets to its cover.
  const setKey = variantShots.length > 0 ? (selection?.variantId ?? "product") : "product";
  useEffect(() => setActive(0), [setKey]);

  const count = shots.length;
  const go = useCallback(
    (dir: 1 | -1) => setActive((i) => (i + dir + count) % count),
    [count],
  );
  const hoverZoom = useHoverZoom();

  // Keep the track on the active image (thumbnails, lightbox nav, variant switch).
  useEffect(() => {
    const t = trackRef.current;
    if (!t || !t.clientWidth) return;
    if (Math.round(t.scrollLeft / t.clientWidth) !== active) {
      t.scrollTo({ left: active * t.clientWidth, behavior: "auto" });
    }
  }, [active, setKey]);

  // Swipes (mobile) update the active image from the scroll position.
  function onTrackScroll() {
    const t = trackRef.current;
    if (!t || !t.clientWidth) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== active && i >= 0 && i < count) setActive(i);
  }

  const altFor = (img: GalleryImage, i: number) =>
    img.alt ?? (i === 0 ? name : `${name} — image ${i + 1}`);

  return (
    <div>
      <div
        className="relative"
        onMouseMove={hoverZoom.onMouseMove}
        onMouseLeave={hoverZoom.onMouseLeave}
      >
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl bg-oat [scrollbar-width:none] md:overflow-hidden [&::-webkit-scrollbar]:hidden"
        >
          {shots.map((img, i) => (
            <button
              key={`${setKey}-${i}`}
              type="button"
              onClick={() => {
                hoverZoom.reset();
                setActive(i);
                setOpen(true);
              }}
              aria-label={`Open image ${i + 1} of ${count} full screen`}
              className="relative aspect-square w-full shrink-0 snap-center cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <BlurImage
                src={img.url}
                alt={altFor(img, i)}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={i === 0}
                className={cn(
                  "object-contain transition-transform duration-200 ease-out",
                  i === active && hoverZoom.origin && "scale-[2]",
                )}
                style={
                  i === active && hoverZoom.origin
                    ? { transformOrigin: `${hoverZoom.origin.x}% ${hoverZoom.origin.y}%` }
                    : undefined
                }
              />
            </button>
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          Image {active + 1} of {count}
        </span>
      </div>

      {count > 1 && (
        <>
          {/* Mobile: position dots (swipe is the control; each image opens the lightbox). */}
          <div aria-hidden className="mt-3 flex justify-center gap-1.5 md:hidden">
            {shots.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === active ? "w-5 bg-foreground/70" : "w-1.5 bg-foreground/20",
                )}
              />
            ))}
          </div>
          {/* md+: thumbnails drive the track. */}
          <div className="mt-3 hidden gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
            {shots.map((img, i) => (
              <button
                key={`${setKey}-t${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "relative size-[4.5rem] shrink-0 overflow-hidden rounded-lg border bg-oat transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === active ? "border-foreground/70" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <BlurImage src={img.url} alt="" fill sizes="72px" className="object-contain" />
              </button>
            ))}
          </div>
        </>
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
        className="max-w-5xl gap-3 border-none bg-background p-3 sm:p-5"
      >
        <DialogTitle className="sr-only">{name} — image gallery</DialogTitle>

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-oat sm:aspect-[4/3]">
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
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium">
              <ZoomIn className="size-3.5" /> Tap to zoom
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 transition hover:bg-background"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 transition hover:bg-background"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium tabular-nums">
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
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg border bg-oat transition",
                  i === active ? "border-foreground/70" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
