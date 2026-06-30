"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { BannerCard, type BannerCardData } from "@/components/storefront/banner-card";
import { cn } from "@/lib/utils";

export type SliderBanner = BannerCardData & { id: string; href: string | null };

// Per-slide auto-advance duration. Images flip quickly; videos play longer so
// the clip is the experience before sliding on.
const IMAGE_MS = 5500;
const VIDEO_MS = 15000;

const isVideoBanner = (b: SliderBanner) => b.mediaType === "VIDEO" && !!b.videoUrl;

/** Renders multiple promotional banners (images and/or videos) as a swipeable,
 *  auto-advancing slider. Each slide holds for its own duration (≈15s for video,
 *  ≈5.5s for images); the active video plays + loops while others stay paused and
 *  reset. Autoplay pauses on hover and auto-advance is off under reduced-motion. */
export function BannerSlider({ banners, bleed }: { banners: SliderBanner[]; bleed?: boolean }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Re-armed whenever the active slide changes (auto or manual), using that
  // slide's own duration. Manual navigation therefore resets the timer cleanly.
  useEffect(() => {
    if (!api || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const current = banners[selected];
    const ms = current && isVideoBanner(current) ? VIDEO_MS : IMAGE_MS;
    const id = setTimeout(() => api.scrollNext(), ms);
    return () => clearTimeout(id);
  }, [api, paused, selected, banners]);

  const nextIndex = banners.length ? (selected + 1) % banners.length : 0;

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, align: "start" }}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <CarouselContent className="ml-0">
        {banners.map((b, i) => (
          <CarouselItem key={b.id} className="pl-0">
            <BannerCard
              banner={b}
              href={b.href}
              bleed={bleed}
              active={i === selected}
              videoPreload={i === selected ? "auto" : i === nextIndex ? "metadata" : "none"}
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "pointer-events-auto h-1.5 rounded-full transition-all",
              i === selected ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
            )}
          />
        ))}
      </div>
    </Carousel>
  );
}
