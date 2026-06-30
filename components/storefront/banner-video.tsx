"use client";

import { useEffect, useRef, useState } from "react";
import { cldVideo } from "@/lib/cld";

/**
 * Autoplaying, muted, looping banner video — no controls, fills the frame
 * (object-cover). It only plays while it's the active slide AND on-screen, and
 * resets to the first frame when it stops, so memory/CPU stay low and the next
 * banner always starts clean. Two Cloudinary sources (webm + mp4) give every
 * browser a compressed, playable file; the poster shows instantly for a smooth
 * load. `preload` is "auto" for the active slide, lighter otherwise.
 */
export function BannerVideo({
  src,
  poster,
  active = true,
  preload = "metadata",
  className,
  width = 1600,
  height = 600,
}: {
  src: string;
  poster?: string | null;
  active?: boolean;
  preload?: "auto" | "metadata" | "none";
  className?: string;
  /** Cloudinary delivery dimensions (cover-cropped). Hero uses a larger frame. */
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && inView) {
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
  }, [active, inView]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster || undefined}
      muted
      loop
      playsInline
      autoPlay={active}
      preload={active ? "auto" : preload}
      aria-hidden
      tabIndex={-1}
      disableRemotePlayback
    >
      <source src={cldVideo(src, { w: width, h: height, fmt: "webm" })} type="video/webm" />
      <source src={cldVideo(src, { w: width, h: height, fmt: "mp4" })} type="video/mp4" />
      {/* Final fallback — the original uploaded file (covers pasted URLs and any
          case where the transformed delivery isn't available). */}
      <source src={src} />
    </video>
  );
}
