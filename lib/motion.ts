"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** One-off check, for event handlers (e.g. a click that scrolls). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
}

/** `scrollTo`/`scrollBy` behavior that honours the reduced-motion setting. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
}

/**
 * Live reduced-motion preference for rendering decisions (autoplay, loops).
 * False on the server and during hydration, then the real value — so markup
 * never mismatches, and toggling the OS setting updates it without a reload.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
