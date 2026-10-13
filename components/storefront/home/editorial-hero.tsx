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
 * Editorial homepage hero: the admin's Hero Slider media fills the whole band
 * and the brand copy sits on an ivory fade — from the left on desktop (upload
 * the desktop image landscape, ~2:1, subject on the right), from the top on
 * phones (mobile image portrait, ~4:5, subject at the bottom).
 * Slides cross-fade; autoplay pauses on hover/focus/hidden tab and is off under
 * reduced motion.
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
  /** Optional Product Reveal overlay, positioned over the media. */
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
    <section
      aria-label="Welcome"
      className="relative isolate min-h-[35rem] overflow-hidden bg-background md:min-h-[34rem] lg:min-h-[min(40rem,calc(100svh-7rem))]"
      data-heat="hero-slider"
    >
      {/* Copy */}
      <div className="shop-container pointer-events-none relative z-20 flex min-h-[inherit] items-start pt-8 pb-24 md:items-center md:py-14 [&_a]:pointer-events-auto">
        <div className="max-w-xl md:max-w-[26rem] lg:max-w-[33rem]">
          {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
          <Heading className="mt-4 font-heading text-display font-medium text-foreground">
            {content.title}
            {content.highlight && <span className="block italic text-primary">{content.highlight}</span>}
          </Heading>
          {content.description && (
            <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/80 sm:text-[17px]">
              {content.description}
            </p>
          )}
          {(content.primaryLabel || content.secondaryLabel) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {content.primaryLabel && (
                <Button asChild className="h-12 gap-2 rounded-md px-7 text-[15px] font-semibold">
                  <Link href={content.primaryHref || "/products"}>
                    {content.primaryLabel} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              {content.secondaryLabel && content.secondaryHref && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-md border-foreground/20 bg-background/60 px-6 text-[15px] font-medium hover:bg-oat"
                >
                  <Link href={content.secondaryHref}>{content.secondaryLabel}</Link>
                </Button>
              )}
            </div>
          )}
          {showPromises && (
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[13px] font-medium text-foreground/85 max-md:hidden">
              {PROMISES.map((p) => (
                <li key={p.label} className="flex items-center gap-2">
                  <p.icon className="size-4 text-primary" strokeWidth={1.6} aria-hidden />
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Media: full-bleed behind the copy. */}
      {count > 0 && (
        <div
          className="absolute inset-0 md:left-auto md:w-[72%] lg:w-[68%]"
          aria-roledescription="carousel"
          aria-label="Featured products"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
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
                "absolute inset-0 bg-oat transition-opacity duration-700 ease-out motion-reduce:transition-none",
                i === index ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <SlideMedia slide={slide} active={i === index} first={i === 0} />
            </div>
          ))}
          {/* Ivory fade so the copy always reads over the photograph. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[78%] bg-[linear-gradient(to_bottom,var(--background)_0%,var(--background)_52%,transparent_100%)] md:inset-y-0 md:right-auto md:h-auto md:w-1/2 md:bg-[linear-gradient(to_right,var(--background)_0%,color-mix(in_oklab,var(--background)_55%,transparent)_55%,transparent_100%)]"
          />
          {active?.href && (
            <Link
              href={active.href}
              aria-label={active.title ? `Shop ${active.title}` : "Shop the featured product"}
              className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
            />
          )}
          {overlay && (
            // Kept to the photo-only area: below the copy on phones, right of it on desktop.
            <div className="absolute inset-x-0 bottom-0 top-[58%] md:inset-y-0 md:left-[40%]">{overlay}</div>
          )}
          {count > 1 && (
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 md:right-auto md:left-[42%]">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous slide"
                className="grid size-11 place-items-center rounded-full bg-background/85 text-foreground shadow-elev-1 backdrop-blur-sm transition-colors hover:bg-background"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-10 rounded-full bg-background/85 px-2 py-1 text-center text-xs font-medium tabular-nums text-foreground">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next slide"
                className="grid size-11 place-items-center rounded-full bg-background/85 text-foreground shadow-elev-1 backdrop-blur-sm transition-colors hover:bg-background"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** One slide's visual, cover-filling the hero media (landscape on desktop,
 *  portrait on phones). */
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
        <source media="(min-width: 768px)" srcSet={cldUrl(desktop, { w: 1600, h: 900, crop: "fill", dpr: "auto" })} />
      )}
      <img
        src={cldUrl(mobile as string, { w: 800, h: 1000, crop: "fill", dpr: "auto" })}
        alt={slide.title ?? ""}
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : "low"}
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
