"use client";

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cldShowcaseImage, cldUrl } from "@/lib/cld";
import { showcaseBackground } from "@/lib/showcase";
import type { ShowcaseDisplayItem } from "@/lib/queries/home";
import { cn } from "@/lib/utils";
import { useInView } from "./showcase/use-in-view";
import type { ShowcaseSceneItem } from "./showcase/types";

/**
 * Premium 3D hero showcase — Apple/Tesla-style cinematic product presentation
 * rendered with real WebGL (react-three-fiber: HDRI-style studio reflections, a
 * mirror floor, soft shadows, PBR/clearcoat material, idle float, cursor/gyro
 * parallax, slow camera drift and subtle bloom/DoF/vignette, crossfading between
 * products). This wrapper is the SSR-friendly chrome (copy/CTA/dots + a flat
 * fallback image); the heavy WebGL stage is lazy, client-only (next/dynamic
 * ssr:false) and only mounts once scrolled into view. Renders nothing for an
 * empty list, so it's safe to always mount.
 */

// Client-only WebGL stage — never SSR'd, code-split so first paint never waits.
const ShowcaseStage = dynamic(() => import("./showcase/showcase-stage"), {
  ssr: false,
});

/** If WebGL init/render throws, keep showing the flat fallback image (children
 *  render nothing). The hero must never blank. */
class StageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Showcase3D({ items }: { items: ShowcaseDisplayItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [armed, setArmed] = useState(false); // mount WebGL only once visible
  const { ref, active } = useInView<HTMLDivElement>();
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (active) setArmed(true);
  }, [active]);

  const count = items.length;
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const go = (i: number) => setIndex(((i % count) + count) % count);

  // Auto-advance (slow, premium). Paused on hover / reduced-motion / off-screen.
  useEffect(() => {
    if (paused || reduced || !active || count <= 1) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [paused, reduced, active, count, next]);

  const item = count > 0 ? items[index] : null;

  // Prefer the bg-removed cutout (true floating product); fall back to the raw
  // image (auto-trimmed/fit). Cutout delivered with alpha preserved.
  const sceneSrc = useMemo(() => {
    if (!item) return "";
    return item.imagePng
      ? cldUrl(item.imagePng, { w: 1200, crop: "fit" })
      : cldShowcaseImage(item.image, { size: 1100 });
  }, [item]);

  const sceneItem: ShowcaseSceneItem | null = useMemo(
    () =>
      item
        ? {
            id: item.id,
            src: sceneSrc,
            animation: item.animation,
            background: item.background,
            rotationSpeed: item.rotationSpeed,
            floatIntensity: item.floatIntensity,
            zoom: item.zoom,
          }
        : null,
    [item, sceneSrc],
  );

  if (!item || !sceneItem) return null;

  const bg = showcaseBackground(item.background);
  const textLight = bg.dark;
  const fallbackSrc = item.imagePng
    ? cldUrl(item.imagePng, { w: 900, crop: "fit" })
    : cldShowcaseImage(item.image, { size: 900 });

  return (
    <section
      aria-label="Featured product showcase"
      className={cn(
        "relative isolate min-h-[560px] overflow-hidden border-y sm:min-h-[620px] lg:min-h-[680px]",
        bg.className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        if (start == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchStart.current = null;
      }}
    >
      {/* Full-bleed stage: a flat fallback image, with the WebGL canvas painting
          opaquely over it once it has initialised. */}
      <div ref={ref} className="absolute inset-0 -z-10">
        <div className="absolute inset-0 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- transform-friendly, optimized via cld */}
          <img
            src={fallbackSrc}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="max-h-[68%] max-w-[60%] object-contain drop-shadow-[0_22px_34px_rgba(0,0,0,0.22)]"
          />
        </div>
        {armed && (
          <StageErrorBoundary>
            <ShowcaseStage item={sceneItem} active={active} reduced={reduced} />
          </StageErrorBoundary>
        )}
      </div>

      {/* Copy overlay */}
      <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-center px-4 py-12">
        <div
          key={item.id}
          className={cn(
            "max-w-md animate-fade-up",
            textLight ? "text-white" : "text-foreground",
          )}
        >
          <p
            className={cn(
              "mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm",
              textLight ? "border-white/25 text-white/80" : "border-primary/20 text-primary",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" /> Featured
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {item.title}
          </h2>
          {item.tagline && (
            <p
              className={cn(
                "mt-3 max-w-md text-base sm:text-lg",
                textLight ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {item.tagline}
            </p>
          )}
          {item.price != null && (
            <p className="mt-4 text-2xl font-semibold">{formatPrice(item.price)}</p>
          )}
          {item.href && (
            <Link
              href={item.href}
              className={cn(
                "mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-elev-2 transition hover:gap-3",
                textLight
                  ? "bg-white text-zinc-900 hover:bg-white/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {item.ctaText} <ArrowRight className="size-4" />
            </Link>
          )}

          {count > 1 && (
            <div className="mt-8 flex items-center gap-2">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${it.title}`}
                  aria-current={i === index}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-7 bg-current" : "w-3 bg-current/30 hover:bg-current/50",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
