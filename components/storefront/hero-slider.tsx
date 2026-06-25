"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";

export type HeroSlideView = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  desktopImage: string;
  mobileImage: string | null;
  ctaText: string | null;
  overlay: number;
  buttonColor: string | null;
  textAlign: string;
  href: string | null;
};

const AUTOPLAY_MS = 6000;

const alignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/** A single slide's visual — shared by the storefront slider and the admin preview. */
export function HeroSlideContent({ slide }: { slide: HeroSlideView }) {
  const align = alignMap[slide.textAlign] ?? alignMap.left;
  const desktop = cldUrl(slide.desktopImage, { w: 2000, h: 900, crop: "fill" });
  const mobile = cldUrl(slide.mobileImage || slide.desktopImage, {
    w: 900,
    h: 1100,
    crop: "fill",
  });

  return (
    <div className="relative size-full overflow-hidden">
      {/* Responsive art direction: portrait crop on phones, wide on desktop. */}
      <picture>
        <source media="(min-width: 768px)" srcSet={desktop} />
        <img
          src={mobile}
          alt={slide.title ?? "Featured"}
          className="absolute inset-0 size-full object-cover"
          loading="eager"
        />
      </picture>

      {/* Overlay for legible text over any image. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/65 md:via-black/30 md:to-transparent"
        style={{ opacity: Math.min(100, Math.max(0, slide.overlay)) / 100 }}
      />

      <div className="relative z-10 mx-auto flex size-full max-w-7xl px-6 sm:px-10">
        <div className={cn("flex w-full max-w-xl flex-col justify-end gap-3 pb-14 md:justify-center md:pb-0", align)}>
          {slide.subtitle && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 drop-shadow">
              {slide.subtitle}
            </span>
          )}
          {slide.title && (
            <h2 className="font-heading text-3xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md sm:text-4xl lg:text-5xl">
              {slide.title}
            </h2>
          )}
          {slide.description && (
            <p className="max-w-md text-sm text-white/85 drop-shadow sm:text-base">
              {slide.description}
            </p>
          )}
          {slide.ctaText && slide.href && (
            <div className="mt-2">
              <Link
                href={slide.href}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-100"
                style={{ backgroundColor: slide.buttonColor || "var(--primary)" }}
              >
                {slide.ctaText}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HeroSlider({ slides }: { slides: HeroSlideView[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  // Autoplay (respects reduced-motion + hover/tab-visibility pause).
  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      className="relative h-[440px] w-full overflow-hidden bg-muted sm:h-[520px] lg:h-[600px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
            "absolute inset-0 transition-opacity duration-700 ease-out",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <HeroSlideContent slide={slide} />
        </div>
      ))}

      {count > 1 && (
        <>
          {/* Arrows (desktop) */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 place-items-center rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/30 md:grid"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 place-items-center rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/30 md:grid"
          >
            <ChevronRight className="size-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full bg-white/50 transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
