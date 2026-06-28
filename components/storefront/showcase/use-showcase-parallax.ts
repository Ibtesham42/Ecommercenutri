"use client";

import { useEffect, useRef } from "react";

export type Vec2 = { x: number; y: number };

/**
 * Tracks a parallax *target* vector (-1..1) from pointer movement and device
 * orientation (gyroscope on mobile). Returns a ref the consumers lerp toward in
 * useFrame, so motion stays smooth and elegant rather than jittery. No listeners
 * are attached when `enabled` is false (reduced-motion / non-tilt presets).
 */
export function useShowcaseParallax(enabled: boolean) {
  const target = useRef<Vec2>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      target.current = { x: 0, y: 0 };
      return;
    }
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    const onPointer = (e: PointerEvent) => {
      target.current = {
        x: clamp((e.clientX / window.innerWidth) * 2 - 1),
        y: clamp((e.clientY / window.innerHeight) * 2 - 1),
      };
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left-right tilt [-90,90]; beta: front-back tilt [-180,180].
      target.current = {
        x: clamp((e.gamma ?? 0) / 35),
        y: clamp(((e.beta ?? 45) - 45) / 35),
      };
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [enabled]);

  return target;
}
