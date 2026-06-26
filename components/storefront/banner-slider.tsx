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

/** Renders multiple promotional banners as a swipeable, auto-advancing slider.
 *  Autoplay pauses on hover and is disabled under prefers-reduced-motion. */
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

  useEffect(() => {
    if (!api || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => api.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [api, paused]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, align: "start" }}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <CarouselContent className="ml-0">
        {banners.map((b) => (
          <CarouselItem key={b.id} className="pl-0">
            <BannerCard banner={b} href={b.href} bleed={bleed} />
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
