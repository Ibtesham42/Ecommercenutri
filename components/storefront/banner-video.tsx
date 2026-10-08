"use client";

import { useEffect, useRef, useState } from "react";
import {
  cldVideoVariant,
  pickVariantHeight,
  normalizeQuality,
  type VariantHeight,
} from "@/lib/video";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Autoplaying, muted, looping banner/hero video — no controls, fills the frame
 * (CSS object-cover: no stretching, no bars; the source is delivered at its own
 * aspect ratio and never upscaled or server-cropped).
 *
 * Adaptive delivery: on mount we pick a 1080/720/480 rung from the viewport +
 * network (Save-Data / 2g / 3g step down), so every visitor gets the best
 * quality their screen can show without wasted bytes. H.264 MP4 is served
 * (predictable quality everywhere); the original upload is the fallback source.
 *
 * Performance: plays only while it's the active slide AND on-screen
 * (IntersectionObserver), resets when deactivated so re-entry starts clean,
 * and preloads fully only when active — inactive slides fetch metadata only.
 */
export function BannerVideo({
  src,
  poster,
  active = true,
  preload = "metadata",
  className,
  quality,
}: {
  src: string;
  poster?: string | null;
  active?: boolean;
  preload?: "auto" | "metadata" | "none";
  className?: string;
  /** Admin-selected delivery profile ("max" | "balanced" | "eco"). */
  quality?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  // Moving, looping media with no pause control: reduced-motion users get the
  // poster (or first frame) instead of playback.
  const reduced = usePrefersReducedMotion();
  const play = active && !reduced;
  // The server can't know the preference, so the autoplay attribute is only
  // set once hydrated; until then the effect below starts playback.
  const hydrated = useHydrated();
  // SSR renders the middle rung; the client corrects it before/at first play.
  const [height, setHeight] = useState<VariantHeight>(720);

  useEffect(() => {
    setHeight(pickVariantHeight());
  }, []);

  const q = normalizeQuality(quality);
  const mp4 = cldVideoVariant(src, { h: height, quality: q, fmt: "mp4" });

  // Re-observe whenever the delivery URL changes: the adaptive rung swap
  // remounts the <video> (key), and an observer bound to the detached element
  // would report "not intersecting" forever — freezing playback on the poster.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mp4]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (play && inView) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
      // Reset only when it's no longer the active slide so re-entry starts fresh.
      if (!active) {
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    }
    // `mp4` re-runs this against the freshly-mounted element after a rung swap.
  }, [active, play, inView, mp4]);

  return (
    <video
      // Remount when the delivery URL changes (React can't swap <source> live).
      key={mp4}
      ref={ref}
      className={className}
      poster={poster || undefined}
      muted
      loop
      playsInline
      autoPlay={hydrated && play}
      preload={play ? "auto" : reduced ? "metadata" : preload}
      aria-hidden
      tabIndex={-1}
      disableRemotePlayback
    >
      <source src={mp4} type="video/mp4" />
      {/* Fallback — the original uploaded file (covers pasted URLs and any case
          where the transformed delivery isn't available). */}
      <source src={src} />
    </video>
  );
}
