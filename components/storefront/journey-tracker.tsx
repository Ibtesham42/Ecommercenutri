"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackClient } from "@/components/storefront/behavior-tracker";

const SESSION_KEY = "nut_journey";

/**
 * Journey-stage signals the other trackers don't already cover. Today that's
 * only the homepage visit (product/category/search/checkout/purchase stages
 * are recorded by their own pages/actions). One event per stage per browser
 * session — the funnel counts unique shoppers, not page loads.
 */
export function JourneyTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      const seen: string[] = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]");
      if (seen.includes("home")) return;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen, "home"]));
    } catch {
      return; // no sessionStorage (private mode) — skip rather than double-count
    }
    trackClient({ type: "HOME_VIEW", path: "/" });
  }, [pathname]);

  return null;
}
