/**
 * Hero "Product Reveal" tuning sheet — every timeline/physics/look constant for
 * the packet-pour overlay lives here so the whole animation is adjustable in one
 * place (same philosophy as `lib/showcase-config.ts`). Deliberately free of
 * DOM/JSX imports; the render components (`components/storefront/hero-reveal/*`)
 * read these. Distances are expressed relative to a 320px-tall stage and scaled
 * by the measured stage height at runtime, so the motion looks identical on
 * mobile and desktop.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const t01 = (v: number) => Math.min(1, Math.max(0, v / 100));

/** Reference stage height the physics constants are normalized to. */
export const BASE_STAGE_H = 320;

// --- Timeline (seconds at timeScale 1; the speed knob scales the clock) ---------
export const TIMELINE = {
  /** Packet fade + rise-in + scale 0.96→1. */
  entrance: { start: 0, dur: 0.9 },
  /** Pre-tear shiver (tiny rotate wiggle) that telegraphs the rip. */
  wobble: { start: 0.9, dur: 0.25 },
  /** Torn strip rotates/flies off; fades over its last 40%. */
  rip: { start: 1.15, dur: 0.55 },
  /** Packet tilts toward the pour side (origin bottom-center). */
  tilt: { start: 1.5, dur: 0.6, deg: 10 },
  /** First piece leaves the packet mouth. */
  spawnStart: 2.0,
  /** Fade-out of packet + pieces before the loop resets. */
  fadeOut: 0.6,
} as const;

// --- Physics (px/s at a 320px stage; scale linearly with measured height) --------
export const PHYSICS = {
  gravity: 1800, // px/s²
  restitution: 0.35, // bounce energy retention
  maxBounces: 2,
  bounceCutoff: 60, // |vy| px/s below which the piece grounds instead of bouncing
  rollDecel: 300, // px/s² horizontal friction while grounded
  restVx: 8, // |vx| below which a grounded piece comes to rest
  spawnVx: [30, 90] as [number, number], // random magnitude, sign biased to pour side
  spawnVy: [-120, -40] as [number, number], // slight upward pop out of the mouth
  spawnSpin: [-140, 140] as [number, number], // deg/s tumble while airborne
  pieceSize: [18, 26] as [number, number], // px at 320px stage, randomized per piece
} as const;

/** 0–100 speed knob → global clock time scale (50 ≈ designed pace). */
export const speedToTimeScale = (speed: number) => lerp(0.6, 1.6, t01(speed));
/** 0–100 speed knob → ms between piece spawns. */
export const speedToStaggerMs = (speed: number) => lerp(650, 180, t01(speed));

// --- Packet mouth spawn point (fractions of the rendered packet box) ------------
export const MOUTH = { x: 0.5, xJitter: 0.15, y: 0.18 } as const;

// --- Rip geometry ----------------------------------------------------------------
// One jagged tear line (percent coords across the packet box, y ≈ 12–15%) shared
// by both clip-paths: the packet body keeps everything BELOW it, the torn strip
// keeps everything ABOVE it. Pre-rip they tile back into the intact image; the
// matching edges are what sell the tear. Clip-paths are static — only
// transform/opacity ever animate.
const TEAR_EDGE: ReadonlyArray<readonly [number, number]> = [
  [0, 13],
  [9, 15],
  [18, 12],
  [28, 15.5],
  [38, 12.5],
  [50, 15],
  [60, 12],
  [70, 15.5],
  [81, 12.5],
  [90, 15],
  [100, 13],
];

const pt = ([x, y]: readonly [number, number]) => `${x}% ${y}%`;

/** Packet body: below the tear line. */
export const packetClipPath = (): string =>
  `polygon(${TEAR_EDGE.map(pt).join(", ")}, 100% 100%, 0% 100%)`;

/** Torn-off strip: above the tear line (complement of the body). */
export const stripClipPath = (): string =>
  `polygon(0% 0%, 100% 0%, ${[...TEAR_EDGE].reverse().map(pt).join(", ")})`;

// --- Default makhana sprite -------------------------------------------------------
// Inline SVG data URI (ivory radial gradient + roast speckles + soft dimple) so
// the animation works with zero uploads. Replaced by the admin piece image.
export const DEFAULT_PIECE_SPRITE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<defs><radialGradient id="g" cx="38%" cy="32%" r="75%">` +
      `<stop offset="0%" stop-color="#fbf5e8"/>` +
      `<stop offset="55%" stop-color="#f0e3c8"/>` +
      `<stop offset="100%" stop-color="#d9c49c"/>` +
      `</radialGradient></defs>` +
      `<circle cx="32" cy="32" r="30" fill="url(#g)"/>` +
      `<circle cx="32" cy="32" r="30" fill="none" stroke="#c3a878" stroke-opacity="0.5"/>` +
      `<ellipse cx="24" cy="40" rx="2.4" ry="1.6" fill="#b89b6f" opacity="0.35"/>` +
      `<ellipse cx="42" cy="26" rx="2" ry="1.4" fill="#b89b6f" opacity="0.3"/>` +
      `<ellipse cx="36" cy="46" rx="1.8" ry="1.2" fill="#a8895c" opacity="0.3"/>` +
      `<ellipse cx="20" cy="24" rx="1.6" ry="1.1" fill="#b89b6f" opacity="0.25"/>` +
      `<path d="M22 18 q10 -6 20 0" fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" opacity="0.55"/>` +
      `</svg>`,
  );

// --- Responsive stage presets ------------------------------------------------------
// The overlay stage is a fixed-size, absolutely-positioned box inside the hero
// slider. Sizes/insets here drive the component's classes; the engine measures
// the real box (getBoundingClientRect) so physics always match what's rendered.
// Mobile anchors to the TOP corner — slide copy/dots are bottom-anchored there.
export const STAGE = {
  desktop: { w: 340, h: 340 }, // lg+, bottom corner, clears the right-4 arrow
  tablet: { w: 260, h: 280 }, // md, bottom corner
  mobile: { w: 150, h: 170 }, // <md, top corner
  /** Piece cap when the stage is mobile-sized. */
  mobileMaxPieces: 6,
} as const;
