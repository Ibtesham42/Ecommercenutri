"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Engine = typeof import("@/components/storefront/engagement-engine");

/**
 * Thin shell for the engagement engine (heatmap + rage clicks + sampled
 * session replay). The engine is dynamic-imported after the browser goes idle
 * so it adds nothing to the critical path; this shell only relays route
 * changes. Renders nothing.
 */
export function EngagementTracker(): null {
  const pathname = usePathname();
  const engine = useRef<Engine | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      import("@/components/storefront/engagement-engine")
        .then((m) => {
          if (cancelled) return;
          engine.current = m;
          m.start(pathRef.current);
        })
        .catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = w.requestIdleCallback?.(load, { timeout: 4000 });
    const timerId = idleId === undefined ? window.setTimeout(load, 2500) : undefined;
    return () => {
      cancelled = true;
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    engine.current?.routeChange(pathname);
  }, [pathname]);

  return null;
}
