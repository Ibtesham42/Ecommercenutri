"use client";

import { useEffect, useState } from "react";
import type { PerfTier } from "@/lib/showcase-config";

/**
 * Lightweight device tiering — deliberately heuristic (no `detect-gpu` dep, which
 * the repo avoids). `low` drops DepthOfField, soft shadows and reduces resolutions
 * so mobile/low-power devices stay smooth. Computed after mount (SSR-safe; starts
 * "high" then downgrades if needed, so the first client paint isn't penalized).
 */
export function usePerfTier(): PerfTier {
  const [tier, setTier] = useState<PerfTier>("high");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cores = navigator.hardwareConcurrency ?? 8;
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const dpr = window.devicePixelRatio || 1;

    const low =
      reduced ||
      cores <= 4 ||
      mobile ||
      (coarse && small) ||
      (coarse && dpr > 2.5);

    setTier(low ? "low" : "high");
  }, []);

  return tier;
}
