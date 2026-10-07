"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { preload } from "react-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Leaf, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";
import { normalizeQuality, resolvePoster } from "@/lib/video";
import { BannerVideo } from "@/components/storefront/banner-video";
import type { HeroSlideView } from "@/components/storefront/hero-slider";
import type { HeroContent } from "@/lib/validations/admin";

const AUTOPLAY_MS = 6000;
const VIDEO_MS = 15000;
const isVideo = (s: HeroSlideView) => s.mediaType === "VIDEO" && !!s.videoUrl;

/** Product promises already made elsewhere on the site (trust band, About). */
const PROMISES = [
  { icon: ShieldCheck, label: "Premium quality" },
  { icon: Leaf, label: "Freshly packed" },
  { icon: Truck, label: "Pan-India delivery" },
] as const;

/**
 * Editorial homepage hero: brand copy on the left (the admin-editable Hero
 * content), the admin's Hero Slider media on the right in a portrait frame —
 * every slide is portrait (~3:4), which the old full-bleed landscape slider
 * could only show by blowing it up and cropping. Slides cross-fade; the slide's
 * own title + controls sit under the frame instead of over the artwork.
 * Autoplay pauses on hover/focus/hidden tab and is off under reduced motion.
 */
export function EditorialHero({
  content,
  slides,
  headingAs: Heading = "h1",
  showPromises = true,
  overlay,
}: {
  content: HeroContent;
  slides: HeroSlideView[];
  /** h2 when the legacy hero block (which owns the h1) is also shown. */
  headingAs?: "h1" | "h2";
  /** Off when the growth trust band renders directly below (same promises). */
  showPromises?: boolean;
  /** Optional Product Reveal overlay, positioned over the frame. */
  overlay?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const active = slides[index];

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ms = active && isVideo(active) ? VIDEO_MS : AUTOPLAY_MS;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearTimeout(t);
  }, [count, paused, index, active]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <section aria-label="Welcome" className="bg-background" data-heat="hero-slider">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pt-6 pb-12 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:gap-10 md:py-12 lg:gap-16 lg:py-10">
        {/* Copy */}
        <div className="max-w-xl">
          {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
          <Heading className="mt-4 font-heading text-display font-medium text-foreground">
            {content.title}
            {content.highlight && <span className="block text-primary">{content.highlight}</span>}
          </Heading>
          {content.description && (
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              {content.description}
            </p>
          )}
          {(content.primaryLabel || content.secondaryLabel) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {content.primaryLabel && (
                <Button asChild className="h-12 gap-2 rounded-md px-6 text-[15px] font-semibold">
                  <Link href={content.primaryHref || "/products"}>
                    {content.primaryLabel} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              {content.secondaryLabel && content.secondaryHref && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-md border-foreground/20 bg-transparent px-6 text-[15px] font-medium hover:bg-oat"
                >
                  <Link href={content.secondaryHref}>{content.secondaryLabel}</Link>
                </Button>
              )}
            </div>
          )}
          {showPromises && (
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 text-[13px] text-muted-foreground">
              {PROMISES.map((p) => (
                <li key={p.label} className="flex items-center gap-2">
                  <p.icon className="size-4 text-primary" strokeWidth={1.6} aria-hidden />
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Media */}
        {count > 0 && (
          <div
            className="mx-auto w-full max-w-[28rem] md:max-w-none lg:mx-0 lg:w-fit lg:justify-self-end"
            aria-roledescription="carousel"
            aria-label="Featured products"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div
              className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-oat lg:h-[min(36rem,calc(100svh-21rem))] lg:min-h-[26rem] lg:w-auto"
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
                touchX.current = null;
              }}
            >
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  aria-hidden={i !== index}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
                    i === index ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <SlideMedia slide={slide} active={i === index} first={i === 0} />
                </div>
              ))}
              {active?.href && (
                <Link
                  href={active.href}
                  aria-label={active.title ? `Shop ${active.title}` : "Shop the featured product"}
                  className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
                />
              )}
              {overlay}
            </div>

            <div className="mt-4 flex min-h-11 items-center justify-between gap-4">
              <div className="min-w-0" aria-live="polite">
                {active?.title ? (
                  <>
                    <p className="truncate font-heading text-lg font-medium leading-tight">{active.title}</p>
                    {active.subtitle && (
                      <p className="truncate text-sm text-muted-foreground">{active.subtitle}</p>
                    )}
                  </>
                ) : null}
              </div>
              {count > 1 && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    aria-label="Previous slide"
                    className="grid size-11 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    aria-label="Next slide"
                    className="grid size-11 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** One slide's visual, filling the portrait frame (no baked-in text cropped:
 *  the frame matches the media's own ~3:4 ratio). */
function SlideMedia({
  slide,
  active,
  first,
}: {
  slide: HeroSlideView;
  active: boolean;
  first: boolean;
}) {
  if (isVideo(slide)) {
    const quality = normalizeQuality(slide.videoQuality);
    const poster = resolvePoster(slide.videoUrl, slide.videoPoster, quality);
    // A <video poster> is found only after HTML parse; preload the LCP one from <head>.
    if (first && poster) preload(poster, { as: "image", fetchPriority: "high" });
    return (
      <BannerVideo
        src={slide.videoUrl as string}
        poster={poster || undefined}
        active={active}
        quality={quality}
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  const desktop = slide.desktopImage;
  const mobile = slide.mobileImage || slide.desktopImage;
  if (!desktop && !mobile) return null;
  return (
    <picture>
      {desktop && (
        <source media="(min-width: 768px)" srcSet={cldUrl(desktop, { w: 900, h: 1200, crop: "fill", dpr: "auto" })} />
      )}
      <img
        src={cldUrl(mobile as string, { w: 800, h: 1066, crop: "fill", dpr: "auto" })}
        alt={slide.title ?? ""}
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : "low"}
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
