"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { resolvePoster, normalizeQuality } from "@/lib/video";
import { cn } from "@/lib/utils";
import { BannerVideo } from "@/components/storefront/banner-video";

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
  /** "IMAGE" (default) or "VIDEO". */
  mediaType?: string | null;
  videoUrl?: string | null;
  /** Admin-chosen poster (thumbnail pick / custom upload); null = auto frame. */
  videoPoster?: string | null;
  /** Delivery profile: "max" | "balanced" | "eco". */
  videoQuality?: string | null;
};

const AUTOPLAY_MS = 6000;
const VIDEO_MS = 15000;

const isVideoSlide = (s: HeroSlideView) => s.mediaType === "VIDEO" && !!s.videoUrl;

const alignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/** A single slide's visual — shared by the storefront slider and the admin
 *  preview. Pass `preview` to force a device crop (the storefront uses a
 *  viewport-driven `<picture>`, which a constrained preview frame can't honor). */
export function HeroSlideContent({
  slide,
  preview,
  active = true,
}: {
  slide: HeroSlideView;
  preview?: "desktop" | "mobile";
  /** Slider passes false for off-slides so their video pauses/resets. */
  active?: boolean;
}) {
  // Video slide: the video is the full visual — no overlay/text (like banners).
  if (isVideoSlide(slide)) {
    const quality = normalizeQuality(slide.videoQuality);
    // Poster priority: admin-chosen frame/custom image → sharp auto first frame.
    const poster = resolvePoster(slide.videoUrl, slide.videoPoster, quality);
    return (
      <div className="relative size-full overflow-hidden bg-black">
        <BannerVideo
          src={slide.videoUrl as string}
          poster={poster || undefined}
          active={preview ? true : active}
          quality={quality}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }

  const align = alignMap[slide.textAlign] ?? alignMap.left;
  // Show the WHOLE uploaded image (c_fit, never cropped) + auto format/quality +
  // retina. A blurred copy fills the frame so any aspect ratio looks premium
  // without stretching, zooming, or cropping the artwork.
  const fit = { crop: "fit", dpr: "auto" } as const;
  const desktop = cldUrl(slide.desktopImage, { w: 2000, h: 1000, ...fit });
  const mobile = cldUrl(slide.mobileImage || slide.desktopImage, { w: 1100, h: 1300, ...fit });
  const ambient = cldUrl(slide.desktopImage, { w: 200, h: 110, crop: "fill" });

  return (
    <div className="relative size-full overflow-hidden bg-neutral-950">
      {/* Ambient blurred backdrop — fills the frame using the image's own colors. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ambient}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-125 object-cover blur-2xl"
      />
      {/* The uploaded image, shown in full (auto-adjusts to any aspect ratio). */}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview === "mobile" ? mobile : desktop}
          alt={slide.title ?? "Featured"}
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        <picture>
          <source media="(min-width: 768px)" srcSet={desktop} />
          <img
            src={mobile}
            alt={slide.title ?? "Featured"}
            sizes="100vw"
            className="absolute inset-0 size-full object-contain"
            loading="eager"
          />
        </picture>
      )}

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

  // Autoplay (respects reduced-motion + hover/tab-visibility pause). Re-armed on
  // each slide using its own duration: video slides hold ~15s, images ~6s.
  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const current = slides[index];
    const ms = current && isVideoSlide(current) ? VIDEO_MS : AUTOPLAY_MS;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearTimeout(t);
  }, [count, paused, index, slides]);

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
      data-heat="hero-slider"
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
      {/* A single translateX track guarantees exactly one slide in view (no
          overlap) and a smooth horizontal transition. */}
      <div
        className="flex size-full transition-transform duration-700 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== index}
            className="relative h-full w-full shrink-0 basis-full"
          >
            <HeroSlideContent slide={slide} active={i === index} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {/* Arrows — small on mobile, larger on desktop. */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 z-20 grid -translate-y-1/2 place-items-center rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/50 md:left-4 md:bg-white/15 md:p-2 md:hover:bg-white/30"
          >
            <ChevronLeft className="size-4 md:size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 z-20 grid -translate-y-1/2 place-items-center rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/50 md:right-4 md:bg-white/15 md:p-2 md:hover:bg-white/30"
          >
            <ChevronRight className="size-4 md:size-5" />
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
