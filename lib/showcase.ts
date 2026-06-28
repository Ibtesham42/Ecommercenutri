/** 3D hero showcase catalog — the single source of truth for animation presets,
 *  background styles and per-style behavior. Client-safe (no imports) so the admin
 *  manager (select options), the Zod schema and the WebGL engine all share it. The
 *  engine is preset-driven (reads the motion flags), so new looks are added here
 *  without touching render code. Numeric look/motion constants live in
 *  lib/showcase-config.ts. */

export const SHOWCASE_ANIMATIONS = [
  { key: "float", label: "Floating Product" },
  { key: "rotate360", label: "Slow 360° Rotation" },
  { key: "glass", label: "Premium Glass Display" },
  { key: "spotlight", label: "Luxury Spotlight" },
  { key: "parallax", label: "Parallax Motion" },
  { key: "focus", label: "Hero Product Focus" },
  { key: "multi", label: "Multi-Product Showcase" },
  { key: "flip", label: "Premium Card Flip" },
  { key: "depth", label: "Depth Hover" },
  { key: "carousel", label: "Smooth Carousel" },
] as const;

export type ShowcaseAnimation = (typeof SHOWCASE_ANIMATIONS)[number]["key"];

export const SHOWCASE_BACKGROUNDS = [
  { key: "aurora", label: "Aurora Gradient" },
  { key: "spotlight", label: "Dark Spotlight" },
  { key: "minimal", label: "Minimal Light" },
  { key: "mesh", label: "Brand Mesh" },
  { key: "studio", label: "Studio Grey" },
] as const;

export type ShowcaseBackground = (typeof SHOWCASE_BACKGROUNDS)[number]["key"];

export const SHOWCASE_ANIMATION_KEYS = SHOWCASE_ANIMATIONS.map((a) => a.key);
export const SHOWCASE_BACKGROUND_KEYS = SHOWCASE_BACKGROUNDS.map((b) => b.key);

export function isShowcaseAnimation(v: string): v is ShowcaseAnimation {
  return (SHOWCASE_ANIMATION_KEYS as string[]).includes(v);
}
export function isShowcaseBackground(v: string): v is ShowcaseBackground {
  return (SHOWCASE_BACKGROUND_KEYS as string[]).includes(v);
}

/** How a preset behaves. The WebGL engine (components/storefront/showcase/*) reads
 *  these flags + the per-item intensities (0-100) to drive float / turntable /
 *  parallax / spotlight / glass behavior. */
export type ShowcaseMotion = {
  float: boolean; // vertical floating bob
  spin: boolean; // continuous Y-axis rotation
  tilt: boolean; // pointer/scroll parallax tilt
  flip: boolean; // 3D card flip between front/back image
  glass: boolean; // glass reflection plate behind the product
  spotlight: boolean; // radial spotlight beam
  dark: boolean; // prefers a dark stage (text goes light)
};

const MOTION: Record<ShowcaseAnimation, ShowcaseMotion> = {
  float:     { float: true,  spin: false, tilt: true,  flip: false, glass: false, spotlight: false, dark: false },
  rotate360: { float: false, spin: true,  tilt: false, flip: false, glass: false, spotlight: false, dark: false },
  glass:     { float: true,  spin: false, tilt: true,  flip: false, glass: true,  spotlight: false, dark: false },
  spotlight: { float: true,  spin: false, tilt: true,  flip: false, glass: false, spotlight: true,  dark: true  },
  parallax:  { float: false, spin: false, tilt: true,  flip: false, glass: false, spotlight: false, dark: false },
  focus:     { float: true,  spin: false, tilt: false, flip: false, glass: false, spotlight: true,  dark: false },
  multi:     { float: true,  spin: false, tilt: true,  flip: false, glass: false, spotlight: false, dark: false },
  flip:      { float: false, spin: false, tilt: true,  flip: true,  glass: false, spotlight: false, dark: false },
  depth:     { float: true,  spin: false, tilt: true,  flip: false, glass: false, spotlight: false, dark: false },
  carousel:  { float: false, spin: false, tilt: false, flip: false, glass: false, spotlight: false, dark: false },
};

export function showcaseMotion(animation: string): ShowcaseMotion {
  return isShowcaseAnimation(animation) ? MOTION[animation] : MOTION.float;
}

/** Background → stage classes. `dark` returns whether text should be light. */
export function showcaseBackground(
  key: string,
): { className: string; dark: boolean } {
  switch (key) {
    case "spotlight":
      return {
        className:
          "bg-[radial-gradient(120%_120%_at_50%_-10%,#1f2937_0%,#0b0f14_60%,#05080b_100%)]",
        dark: true,
      };
    case "minimal":
      return { className: "bg-gradient-to-b from-background to-muted/40", dark: false };
    case "mesh":
      return {
        className:
          "bg-[radial-gradient(60%_80%_at_15%_20%,color-mix(in_oklch,var(--primary)_22%,transparent)_0%,transparent_60%),radial-gradient(60%_80%_at_85%_30%,color-mix(in_oklch,var(--gold)_25%,transparent)_0%,transparent_60%)] bg-accent/20",
        dark: false,
      };
    case "studio":
      return { className: "bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900", dark: false };
    case "aurora":
    default:
      return {
        className:
          "bg-[radial-gradient(80%_100%_at_20%_0%,color-mix(in_oklch,var(--primary)_30%,transparent),transparent_55%),radial-gradient(80%_100%_at_90%_20%,color-mix(in_oklch,var(--gold)_30%,transparent),transparent_55%),linear-gradient(to_bottom,var(--accent),var(--background))]",
        dark: false,
      };
  }
}

/** Clamp a 0-100 intensity to a sane number. */
export function clampIntensity(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}
