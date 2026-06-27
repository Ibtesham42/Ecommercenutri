"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cldShowcaseImage } from "@/lib/cld";
import { showcaseMotion, showcaseBackground, clampIntensity } from "@/lib/showcase";
import type { ShowcaseDisplayItem } from "@/lib/queries/home";
import { cn } from "@/lib/utils";

/**
 * Premium 3D hero showcase — Apple/Tesla-style depth via GPU-accelerated CSS 3D
 * transforms (no heavy WebGL runtime). Reusable engine: it's preset-driven
 * (see `lib/showcase.ts`), auto-advances, pauses on hover (desktop), supports
 * swipe (mobile) and is fully gated by `prefers-reduced-motion`. Renders nothing
 * for an empty list, so it's safe to always mount.
 */
export function Showcase3D({ items }: { items: ShowcaseDisplayItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Pointer parallax (-1..1), eased toward 0 when the pointer leaves.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const count = items.length;
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const go = (i: number) => setIndex(((i % count) + count) % count);

  // Auto-advance (slow, premium). Paused on hover / reduced-motion / single item.
  useEffect(() => {
    if (paused || reduced || count <= 1) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [paused, reduced, count, next]);

  function onPointerMove(e: React.PointerEvent) {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  if (count === 0) return null;

  const item = items[index];
  const motion = showcaseMotion(item.animation);
  const bg = showcaseBackground(item.background);
  const float = clampIntensity(item.floatIntensity);
  const spin = clampIntensity(item.rotationSpeed);
  const zoom = clampIntensity(item.zoom);

  // Map 0-100 knobs → concrete motion values.
  const floatPx = motion.float && !reduced ? 6 + (float / 100) * 22 : 0;
  const spinDur = motion.spin ? 60 - (spin / 100) * 45 : 0; // 60s … 15s
  const tiltMax = motion.tilt && !reduced ? 10 : 0;
  const cardScale = 0.86 + (zoom / 100) * 0.16;
  // Any uploaded image (any size/format/aspect) is auto-trimmed, centered and
  // fit into a consistent square — no transparent PNG or manual editing needed.
  const productSrc = cldShowcaseImage(item.image);
  const textLight = bg.dark;

  return (
    <section
      aria-label="Featured product showcase"
      className={cn("relative overflow-hidden border-y", bg.className)}
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:gap-8">
        {/* Copy */}
        <div className={cn("order-2 lg:order-1", textLight && "text-white")}>
          <p
            className={cn(
              "mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
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
                    i === index
                      ? "w-7 bg-current"
                      : "w-3 bg-current/30 hover:bg-current/50",
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* 3D stage */}
        <div
          ref={stageRef}
          className="order-1 lg:order-2"
          style={{ perspective: "1200px" }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => {
            setPaused(false);
            setTilt({ x: 0, y: 0 });
          }}
          onPointerMove={onPointerMove}
          onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            if (start == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            touchStart.current = null;
          }}
        >
          <div
            className="relative mx-auto aspect-square w-full max-w-md"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${tilt.y * -tiltMax}deg) rotateY(${tilt.x * tiltMax}deg)`,
              transition: "transform 300ms ease-out",
            }}
          >
            {/* Spotlight beam */}
            {motion.spotlight && (
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "radial-gradient(closest-side, color-mix(in oklch, var(--gold) 35%, transparent), transparent 70%)",
                  transform: "translateZ(-60px) scale(1.1)",
                }}
              />
            )}
            {/* Glass plate */}
            {motion.glass && (
              <div
                className="absolute inset-6 -z-10 rounded-[2rem] border border-white/30 bg-white/10 backdrop-blur-md"
                style={{ transform: "translateZ(-40px)" }}
              />
            )}

            {/* Floating / spinning product */}
            <div
              key={item.id}
              className="relative size-full"
              style={{
                transformStyle: "preserve-3d",
                // At most one transform animation runs (presets never combine
                // float + spin), so they never conflict on `transform`.
                animation: reduced
                  ? undefined
                  : floatPx
                    ? `showcase-float ${4 + (100 - float) / 50}s ease-in-out infinite`
                    : spinDur
                      ? `showcase-spin ${spinDur}s linear infinite`
                      : undefined,
                ["--float-px" as string]: `${floatPx}px`,
              }}
            >
              {/* Universal premium product stage — any uploaded image (auto-trimmed,
                  centered, fit) is presented on a soft glass pedestal with inner
                  spotlight and glossy sheen. The product is always centered. */}
              <div
                className="relative grid size-full place-items-center overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-white to-zinc-100 p-6 shadow-elev-3 ring-1 ring-black/5 dark:from-zinc-800 dark:to-zinc-900 dark:ring-white/10 sm:p-8"
                style={{ transform: `scale(${cardScale})` }}
              >
                {/* Inner spotlight behind the product */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(58% 52% at 50% 45%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%)",
                  }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- transform-friendly, lazy, optimized via cldShowcaseImage */}
                <img
                  src={productSrc}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="relative col-start-1 row-start-1 max-h-full max-w-full self-center justify-self-center object-contain drop-shadow-[0_22px_34px_rgba(0,0,0,0.22)]"
                />
                {/* Glossy top sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/55 to-transparent dark:from-white/10"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
