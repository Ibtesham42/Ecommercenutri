"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Engine = typeof import("@/components/storefront/engagement-engine");

/**
 * Thin shell for the engagement engine (heatmap + rage clicks + sampled
 * session replay). The engine is dynamic-imported (a separate chunk, so it
 * stays out of the shared First-Load JS) but started PROMPTLY — right after
 * first paint and on the first interaction, whichever comes first. The old
 * requestIdleCallback/2.5s delay meant the click listener attached seconds
 * late, so early clicks (the bulk of them on a fast/low-traffic store) were
 * never recorded while impressions kept accruing — hence "views but 0 clicks".
 * This shell only loads the engine and relays route changes. Renders nothing.
 */
export function EngagementTracker(): null {
  const pathname = usePathname();
  const engine = useRef<Engine | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;
    let started = false;

    const start = () => {
      if (started || cancelled) return;
      started = true;
      cleanupTriggers();
      import("@/components/storefront/engagement-engine")
        .then((m) => {
          if (cancelled) return;
          engine.current = m;
          m.start(pathRef.current);
        })
        .catch(() => {});
    };

    // Start on the first real interaction so even the earliest clicks/scrolls
    // are captured; these listeners are capture-phase + passive and remove
    // themselves once the engine takes over.
    const onFirst = () => start();
    const triggers = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const addTriggers = () =>
      triggers.forEach((t) => window.addEventListener(t, onFirst, { capture: true, passive: true, once: true }));
    const cleanupTriggers = () =>
      triggers.forEach((t) => window.removeEventListener(t, onFirst, { capture: true }));
    addTriggers();

    // ...and promptly after first paint even without interaction (idle browse).
    const raf = requestAnimationFrame(() => {
      // Two frames out keeps it off the critical paint path but still ~30ms in.
      requestAnimationFrame(start);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupTriggers();
    };
  }, []);

  useEffect(() => {
    engine.current?.routeChange(pathname);
  }, [pathname]);

  return null;
}
