/**
 * Showcase WebGL "tuning sheet" — every look & motion constant for the 3D hero
 * lives here so the whole Apple/Tesla aesthetic is adjustable in one place. This
 * file is deliberately free of `three`/JSX imports (only the client-safe catalog
 * in `lib/showcase.ts`) so it can be imported anywhere without pulling the WebGL
 * runtime. The render components (`components/storefront/showcase/*`) read these.
 */

import { clampIntensity, type ShowcaseBackground } from "@/lib/showcase";

export type PerfTier = "high" | "low";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0-100 intensity → 0..1 (clamped). */
const t01 = (intensity: number) => clampIntensity(intensity) / 100;

// --- Camera --------------------------------------------------------------------
export const CAMERA = {
  position: [0, 0.18, 4.3] as [number, number, number],
  fov: 32,
  target: [0, 0.05, 0] as [number, number, number],
  driftRadius: 0.32, // max world-unit orbit offset (kept < ~3° feel)
  driftSpeed: 0.09, // base rad/s, scaled by rotationSpeed
  fovBreathDeg: 1.1, // slow FOV "breathing" amplitude
  fovBreathSpeed: 0.12,
} as const;

// --- Tone mapping --------------------------------------------------------------
export const TONEMAPPING = { exposure: 1.1 } as const;

// --- 3-point lighting ----------------------------------------------------------
export const LIGHTS = {
  ambient: 0.35,
  key: { position: [3.2, 4, 3] as [number, number, number], intensity: 2.3, color: "#ffffff" },
  fill: { position: [-3.5, 1.2, 2.2] as [number, number, number], intensity: 0.8, color: "#eaf2ff" },
  rim: { position: [0, 3.2, -4] as [number, number, number], intensity: 1.7, color: "#ffffff" },
  shadowMapSize: 1024,
} as const;

// --- Environment ---------------------------------------------------------------
// Built procedurally from <Lightformer>s (see showcase/environment.tsx) — no
// external HDRI/CDN fetch, no binary asset, works fully offline. The cubemap
// resolution is tuned per tier; `intensity` scales reflection strength.
export const ENV = { resolution: 256, intensity: 1.0, blur: 0.4 } as const;

// --- Reflective floor + contact shadow -----------------------------------------
export const FLOOR = {
  y: -1.15,
  size: 14,
  resolution: 1024, // overridden per tier
  mixStrength: 1.1,
  blur: [320, 110] as [number, number], // soft, premium reflection
  roughness: 0.9,
  metalness: 0.25,
  mirror: 0.35,
  contactShadow: { opacity: 0.42, blur: 2.5, scale: 7, far: 3.2, resolution: 512 },
} as const;

// --- Product plane: material + motion ------------------------------------------
export const PRODUCT = {
  baseScale: 2.3, // world height of the framed square at zoom = 50
  zoomRange: [0.85, 1.15] as [number, number],
  framePadding: 0.1, // matches the client auto-frame padding (~10%)
  material: {
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.0,
  },
  floatAmplitude: [0.0, 0.12] as [number, number], // world units at intensity 0..100
  floatSpeed: 0.9, // base rad/s
  swayDeg: 6, // ± rotation sway with the float
  spinSeconds: [60, 15] as [number, number], // sec/rev at rotationSpeed 0..100
  swapFadeMs: 700,
  parallaxMax: 0.22, // world-unit product offset from cursor/gyro
} as const;

// --- Postprocessing ------------------------------------------------------------
export const EFFECTS = {
  // High threshold so only specular highlights bloom — never the flat backdrop.
  bloom: {
    intensity: 0.5,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.22,
    mipmapBlur: true,
    radius: 0.6,
  },
  dof: { focusDistance: 0.02, focalLength: 0.05, bokehScale: 2.2 },
  vignette: { offset: 0.3, darkness: 0.5 },
  spotlightVignette: { offset: 0.22, darkness: 0.7 }, // when the spotlight preset is active
} as const;

// --- Per-tier overrides (mobile / low-power drops the expensive bits) -----------
export const TIER: Record<PerfTier, {
  maxDpr: number;
  dof: boolean;
  shadows: boolean;
  floorResolution: number;
  bloomMipmap: boolean;
  envBlur: number;
}> = {
  high: { maxDpr: 2, dof: true, shadows: true, floorResolution: 1024, bloomMipmap: true, envBlur: ENV.blur },
  low: { maxDpr: 1.5, dof: false, shadows: false, floorResolution: 256, bloomMipmap: false, envBlur: 0.6 },
};

// --- Background preset → in-canvas scene tuning --------------------------------
// The full-bleed canvas is OPAQUE (so postprocessing — vignette/DoF/bloom — has a
// clean buffer) and renders its own gradient backdrop per preset (top→bottom),
// approximating the matching CSS gradient. The reflective floor + env/exposure are
// tuned to sit naturally on each. `dark` keeps overlaid copy readable.
export const BACKGROUND_SCENE: Record<ShowcaseBackground, {
  envIntensity: number;
  exposure: number;
  floorColor: string;
  backdropTop: string;
  backdropBottom: string;
}> = {
  aurora: { envIntensity: 1.0, exposure: 1.1, floorColor: "#1a1a1a", backdropTop: "#e3f4ee", backdropBottom: "#f2faf7" },
  mesh: { envIntensity: 1.0, exposure: 1.1, floorColor: "#1a1a1a", backdropTop: "#dff2ec", backdropBottom: "#eef0fb" },
  minimal: { envIntensity: 1.1, exposure: 1.15, floorColor: "#e6e6e6", backdropTop: "#f4f5f6", backdropBottom: "#e6e8ea" },
  studio: { envIntensity: 1.0, exposure: 1.05, floorColor: "#cfd0d3", backdropTop: "#ececed", backdropBottom: "#d4d5d8" },
  spotlight: { envIntensity: 0.7, exposure: 1.0, floorColor: "#0a0a0a", backdropTop: "#1f2937", backdropBottom: "#05080b" },
};

// --- 0-100 intensity → concrete value mappings ---------------------------------
/** Product world scale from the `zoom` knob (0-100). */
export function productScale(zoom: number): number {
  const [lo, hi] = PRODUCT.zoomRange;
  return PRODUCT.baseScale * lerp(lo, hi, t01(zoom));
}
/** Idle float amplitude (world units) from `floatIntensity`; 0 when the preset has no float. */
export function floatAmplitude(intensity: number, enabled: boolean): number {
  if (!enabled) return 0;
  const [lo, hi] = PRODUCT.floatAmplitude;
  return lerp(lo, hi, t01(intensity));
}
/** Seconds per full Y rotation from `rotationSpeed` (turntable presets). */
export function spinSecondsPerRev(rotationSpeed: number): number {
  const [slow, fast] = PRODUCT.spinSeconds;
  return lerp(slow, fast, t01(rotationSpeed));
}
/** Camera drift speed (rad/s) from `rotationSpeed`. */
export function cameraDriftSpeed(rotationSpeed: number): number {
  return CAMERA.driftSpeed * (0.45 + 0.55 * t01(rotationSpeed));
}
