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
  | "HEALTH_FACT"
  | "INFOGRAPHIC";

export type Look = {
  key: LookKey;
  label: string;
  description: string;
  /** This look numbers `benefits` as a step sequence ("1. ... 2. ..."), which
   *  only reads naturally when the content genuinely IS a sequence (a recipe/
   *  serving idea) — everywhere else, numbering a list of unrelated facts
   *  looks confused, not designed. Gated in `pickLook` by the caller's
   *  `sequential` flag (true only for the RECIPE content style). */
  sequential?: boolean;
};

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
    sequential: true,
  },
  {
    key: "HEALTH_FACT",
    label: "Health Fact Card",
    description: "Big stat-style callout with a glass fact card and supporting benefit row.",
  },
  {
    key: "INFOGRAPHIC",
    label: "Infographic Grid",
    description: "2x2 icon-stat grid with a small product corner — structured, reference-card feel.",
  },
];

export const LOOK_LABEL: Record<LookKey, string> = Object.fromEntries(
  LOOKS.map((l) => [l.key, l.label]),
) as Record<LookKey, string>;

/**
 * Rotate looks deterministically; never repeat either of the last two.
 *
 * `sequential` should be true only when the post's content genuinely reads as
 * a step sequence (the RECIPE content style — lib/social/styles.ts) — that's
 * the one case a numbered step-card look (RECIPE_EDU) fits. Everywhere else
 * it's excluded from the rotation: numbering a list of unrelated benefit
 * facts ("1. 12g Protein  2. Roasted Not Fried") reads as a layout mistake,
 * not a design choice.
 */
export function pickLook(rotation: number, recentLookKeys: string[], sequential = false): Look {
  const eligible = LOOKS.filter((l) => sequential || !l.sequential);
  const avoid = new Set(recentLookKeys.slice(0, Math.min(2, eligible.length - 1)));
  const start = ((rotation % eligible.length) + eligible.length) % eligible.length;
  for (let i = 0; i < eligible.length; i++) {
    const cand = eligible[(start + i) % eligible.length];
    if (!avoid.has(cand.key)) return cand;
  }
  return eligible[start];
}
