"use client";

import { useEffect, useState, type RefObject } from "react";

export type ViewportPosition = "above" | "visible" | "below";

/**
 * Where an element sits relative to the viewport, for sticky action bars.
 * A scroll listener, not an IntersectionObserver: a fling or an anchor jump can
 * skip straight past the element without ever "intersecting", so IO never fires.
 * Starts as "visible" so no sticky bar flashes in before the first measure.
 * Pass `enabled` when the element mounts after the hook's owner (e.g. behind a
 * client-only gate) so the first measure runs once it exists.
 */
export function useViewportPosition(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): ViewportPosition {
  const [position, setPosition] = useState<ViewportPosition>("visible");
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPosition(r.bottom < 0 ? "above" : r.top > window.innerHeight ? "below" : "visible");
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
  return position;
}
