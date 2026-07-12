/**
 * Content STYLE catalog — the shape a post takes, rotating independently of the
 * 4-week pillar strategy (lib/social/strategy.ts).
 *
 * The pillar says WHAT a post is about (it is pinned to week + daypart, so every
 * morning in a given week shares one). The style says HOW it is written. Without
 * this, successive posts on the same pillar all came out as the same kind of
 * paragraph, which is a large part of why the feed read as repetitive.
 *
 * Client-safe catalog module (project convention): stores KEYS, renders labels,
 * and is the single source of truth for the planner, the AI prompt and the UI.
 */

export type ContentStyle = {
  key: string;
  label: string;
  /** Appended to the AI prompt — the structural brief for this post. */
  brief: string;
  /** Styles that need product facts to work (skipped for brand-only posts). */
  needsProduct?: boolean;
};

export const CONTENT_STYLES: ContentStyle[] = [
  {
    key: "EDUCATIONAL",
    label: "Educational",
    brief:
      "Teach one concrete thing the reader did not know, in plain language. Lead with the insight, not with a preamble.",
  },
  {
    key: "MYTH_VS_FACT",
    label: "Myth vs Fact",
    brief:
      "Name a common belief people actually hold, then correct it honestly. Do not strawman — pick a myth a real person would believe.",
  },
  {
    key: "NUTRITION_FACTS",
    label: "Nutrition Facts",
    brief:
      "Build the post around the real numbers in the product facts. Use ONLY the given figures. Make one number the star.",
    needsProduct: true,
  },
  {
    key: "INGREDIENT_SPOTLIGHT",
    label: "Ingredient Spotlight",
    brief:
      "Zoom in on ONE ingredient and what it does. Specific and sensory, not a list.",
    needsProduct: true,
  },
  {
    key: "QUICK_TIP",
    label: "Quick Tip",
    brief:
      "One tip the reader can act on today. Short, punchy lines. No throat-clearing.",
  },
  {
    key: "DID_YOU_KNOW",
    label: "Did You Know",
    brief:
      "Open on a genuinely surprising fact — but NEVER use the words 'did you know'. Just state the surprising thing.",
  },
  {
    key: "RECIPE",
    label: "Recipe / Serving",
    brief:
      "A simple way to eat it, in 3-4 steps. Real, doable in an Indian kitchen. No exotic ingredients.",
    needsProduct: true,
  },
  {
    key: "COMPARISON",
    label: "Healthy vs Unhealthy",
    brief:
      "Compare a common choice against a better one, fairly and without shaming. The reader should feel informed, not judged.",
  },
  {
    key: "OFFICE_SNACK",
    label: "Office Snacking",
    brief:
      "Speak to the desk worker — the 4pm slump, the meeting-heavy day, the drawer stash. Concrete, not generic.",
  },
  {
    key: "KIDS_NUTRITION",
    label: "Kids' Nutrition",
    brief:
      "Speak to a parent packing a tiffin. Practical, warm, honest about what kids will actually eat.",
  },
  {
    key: "FITNESS",
    label: "Fitness",
    brief:
      "Speak to someone training. Pre/post workout, protein, recovery — grounded, never a supplement-bro pitch.",
  },
  {
    key: "WEIGHT_MANAGEMENT",
    label: "Mindful Portions",
    brief:
      "Portion awareness and satiety, with zero guilt or diet-culture language. Never promise weight loss.",
  },
  {
    key: "TRADITIONAL",
    label: "Traditional Indian Foods",
    brief:
      "Root the post in Indian food heritage — what grandmothers knew, and why it holds up.",
  },
  {
    key: "LIFESTYLE",
    label: "Lifestyle Tip",
    brief:
      "Paint one small, real Indian moment (chai time, commute, monsoon evening) and place the habit inside it.",
  },
  {
    key: "HEALTHY_HABIT",
    label: "Healthy Habit",
    brief:
      "One habit, why it sticks, and how to start it this week. Encouraging, never preachy.",
  },
  {
    key: "PRODUCT_KNOWLEDGE",
    label: "Product Knowledge",
    brief:
      "How it is made, sourced or stored. Reward curiosity with a real detail from the product facts.",
    needsProduct: true,
  },
  {
    key: "FAQ",
    label: "FAQ",
    brief:
      "Answer one question customers genuinely ask. State the question the way a customer would say it.",
  },
  {
    key: "CUSTOMER_STORY",
    label: "Customer Story",
    brief:
      "A relatable customer moment. Do NOT invent a testimonial, a name or a quote — write it as a recognisable situation, not a fabricated review.",
  },
  {
    key: "SEASONAL",
    label: "Seasonal",
    brief:
      "Tie the post to the current Indian season and what people crave in it.",
  },
  {
    key: "FESTIVAL",
    label: "Festival",
    brief:
      "Tie the post to an upcoming Indian festival — gifting, sweets, hosting — without inventing offers or dates.",
  },
];

export const STYLE_LABEL: Record<string, string> = Object.fromEntries(
  CONTENT_STYLES.map((s) => [s.key, s.label]),
);

/**
 * Pick the style for the next post: rotates deterministically through the
 * catalog and NEVER returns the style used by the previous post (requirement:
 * no two consecutive posts share a style).
 *
 * `rotation` is the campaign's post count, so the sequence advances on its own;
 * `recentStyleKeys` (newest first) is what actually enforces the no-repeat rule,
 * including across a restart where the counter would otherwise land on the same
 * style twice.
 */
export function pickStyle(
  rotation: number,
  recentStyleKeys: string[],
  hasProduct: boolean,
): ContentStyle {
  const eligible = CONTENT_STYLES.filter((s) => hasProduct || !s.needsProduct);
  if (eligible.length === 0) return CONTENT_STYLES[0];

  const lastUsed = recentStyleKeys[0];
  // Avoid the last few styles entirely when we have room to; always avoid the
  // immediately previous one.
  const avoid = new Set(recentStyleKeys.slice(0, Math.min(3, eligible.length - 1)));

  const start = ((rotation % eligible.length) + eligible.length) % eligible.length;
  for (let i = 0; i < eligible.length; i++) {
    const cand = eligible[(start + i) % eligible.length];
    if (!avoid.has(cand.key)) return cand;
  }
  // Everything recent — settle for anything that is not literally the last one.
  return eligible.find((s) => s.key !== lastUsed) ?? eligible[0];
}
