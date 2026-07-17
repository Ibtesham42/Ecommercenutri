/**
 * The creative engine's LOOK catalog — the visual design system a post's cover
 * is rendered in. Independent of the content STYLE (lib/social/styles.ts, which
 * governs the WRITING) and the content PILLAR (lib/social/strategy.ts, the
 * topic). Three independent rotations is what keeps a feed of daily posts from
 * ever reading as "the same template again."
 *
 * Client-safe catalog module (project convention): stores keys, renders labels;
 * lib/social/creative/render.tsx holds one layout function per key.
 */

export type LookKey =
  | "EDITORIAL"
  | "LUXURY_MINIMAL"
  | "ORGANIC_WELLNESS"
  | "MODERN_D2C"
  | "APPLE_MINIMAL"
  | "RECIPE_EDU"
  | "HEALTH_FACT";

export type Look = { key: LookKey; label: string; description: string };

export const LOOKS: Look[] = [
  {
    key: "EDITORIAL",
    label: "Editorial Magazine",
    description: "Magazine-style split cover: kicker, oversized serif headline, side column.",
  },
  {
    key: "LUXURY_MINIMAL",
    label: "Luxury Minimal",
    description: "Centered product on a deep tinted canvas, generous negative space, thin rule.",
  },
  {
    key: "ORGANIC_WELLNESS",
    label: "Organic Wellness",
    description: "Soft blurred organic blobs, rounded glass benefit card, warm and natural.",
  },
  {
    key: "MODERN_D2C",
    label: "Modern D2C Infographic",
    description: "Benefit chip row + fact strip, bold sans headline, structured D2C-ad layout.",
  },
  {
    key: "APPLE_MINIMAL",
    label: "Apple-Style Minimal",
    description: "Huge product, single-line typographic statement, ultra-restrained palette.",
  },
  {
    key: "RECIPE_EDU",
    label: "Recipe / How-To",
    description: "Numbered step-card rail beneath the product — serving idea, not just a photo.",
  },
  {
    key: "HEALTH_FACT",
    label: "Health Fact Card",
    description: "Big stat-style callout with a glass fact card and supporting benefit row.",
  },
];

export const LOOK_LABEL: Record<LookKey, string> = Object.fromEntries(
  LOOKS.map((l) => [l.key, l.label]),
) as Record<LookKey, string>;

/** Rotate looks deterministically; never repeat either of the last two. */
export function pickLook(rotation: number, recentLookKeys: string[]): Look {
  const avoid = new Set(recentLookKeys.slice(0, Math.min(2, LOOKS.length - 1)));
  const start = ((rotation % LOOKS.length) + LOOKS.length) % LOOKS.length;
  for (let i = 0; i < LOOKS.length; i++) {
    const cand = LOOKS[(start + i) % LOOKS.length];
    if (!avoid.has(cand.key)) return cand;
  }
  return LOOKS[start];
}
