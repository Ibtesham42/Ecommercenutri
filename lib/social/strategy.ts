import type {
  SocialContentPillar,
  SocialDaypart,
} from "@prisma/client";

/**
 * The 4-week rotating content strategy — the single source of truth shared by
 * the planner, the AI generator and the admin calendar UI. Client-safe (only
 * type-only Prisma imports), stores enum KEYS and renders labels separately, in
 * line with the project's "feature catalog" convention.
 *
 * Each week has a morning pillar and an evening pillar; each pillar carries a
 * rotating list of "angles" so successive posts on the same pillar stay fresh.
 * Week is derived from the day of the month (1–4); after week 4 the cycle
 * repeats.
 */

export type Pillar = SocialContentPillar;
export type Daypart = SocialDaypart;

export type StrategySlot = {
  week: number; // 1-4
  daypart: Daypart;
  pillar: Pillar;
  /** Rotating content angles for this pillar; the planner cycles through them. */
  angles: string[];
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  PRODUCT_KNOWLEDGE: "Product Knowledge",
  HEALTHY_SNACKING: "Healthy Snacking",
  TARGET_AUDIENCE: "Target Audience",
  WHY_NUTRIYET: "Why Nutriyet",
  LIFESTYLE: "Lifestyle",
  RECIPES: "Recipes & Serving",
  COMMUNITY: "Community",
  CUSTOMER_STORIES: "Customer Stories",
};

export const DAYPART_LABEL: Record<Daypart, string> = {
  MORNING: "Morning",
  EVENING: "Evening",
};

/** The full 4×2 calendar. Order matters: [morning, evening] per week. */
export const STRATEGY: StrategySlot[] = [
  // ── Week 1 ──────────────────────────────────────────────────────────────
  {
    week: 1,
    daypart: "MORNING",
    pillar: "PRODUCT_KNOWLEDGE",
    angles: [
      "Ingredients spotlight",
      "The product's story",
      "Traditional uses",
      "Storage tips",
      "Where it comes from (origin)",
      "Little-known product facts",
    ],
  },
  {
    week: 1,
    daypart: "EVENING",
    pillar: "HEALTHY_SNACKING",
    angles: [
      "Why smart snacking matters",
      "Building healthy daily habits",
      "Traditional Indian foods done right",
      "Snacking without the guilt",
      "Reading a label the smart way",
      "Portion-friendly munching",
    ],
  },
  // ── Week 2 ──────────────────────────────────────────────────────────────
  {
    week: 2,
    daypart: "MORNING",
    pillar: "TARGET_AUDIENCE",
    angles: [
      "For the gym crowd",
      "For the office desk",
      "For students",
      "For kids' lunchboxes",
      "For busy parents",
      "For travellers",
      "For working professionals",
      "For senior citizens",
    ],
  },
  {
    week: 2,
    daypart: "EVENING",
    pillar: "WHY_NUTRIYET",
    angles: [
      "Our brand story",
      "Transparency you can trust",
      "Our quality standards",
      "The roasting process",
      "Clean ingredients, nothing hidden",
      "How it's made",
    ],
  },
  // ── Week 3 ──────────────────────────────────────────────────────────────
  {
    week: 3,
    daypart: "MORNING",
    pillar: "LIFESTYLE",
    angles: [
      "A healthy morning routine",
      "Office snacks that work",
      "Snacks for the road",
      "Movie-night munching",
      "Family snack time",
      "Post-workout refuel",
    ],
  },
  {
    week: 3,
    daypart: "EVENING",
    pillar: "RECIPES",
    angles: [
      "Simple serving ideas",
      "Fit it into a healthy routine",
      "A quick nutrition tip",
      "Pair it with hydration",
      "Mindful eating in practice",
      "A 2-minute snack upgrade",
    ],
  },
  // ── Week 4 ──────────────────────────────────────────────────────────────
  {
    week: 4,
    daypart: "MORNING",
    pillar: "COMMUNITY",
    angles: [
      "Quick quiz",
      "This-or-that poll",
      "Myth vs fact",
      "A small challenge",
      "Did you know?",
      "Ask the community",
    ],
  },
  {
    week: 4,
    daypart: "EVENING",
    pillar: "CUSTOMER_STORIES",
    angles: [
      "A customer review",
      "Behind the scenes",
      "Inside our packaging",
      "The founder's story",
      "On the production floor",
      "Our growing community",
    ],
  },
];

/** Week of the month (1–4) for a date, in the given IST-based calendar day. */
export function weekOfMonth(date: Date): number {
  const day = date.getDate();
  return Math.min(4, Math.floor((day - 1) / 7) + 1);
}

/** The strategy slot for a given week (1–4) + daypart. */
export function slotFor(week: number, daypart: Daypart): StrategySlot {
  const w = Math.min(4, Math.max(1, week));
  return (
    STRATEGY.find((s) => s.week === w && s.daypart === daypart) ??
    STRATEGY[0]
  );
}

/** The slot that applies to a specific date + daypart. */
export function slotForDate(date: Date, daypart: Daypart): StrategySlot {
  return slotFor(weekOfMonth(date), daypart);
}

/**
 * Pick the next angle for a pillar, rotating past the ones most recently used.
 * `usedCount` is how many times this pillar has been posted before — cycling
 * through `angles` deterministically keeps successive posts varied.
 */
export function angleAt(slot: StrategySlot, usedCount: number): string {
  if (slot.angles.length === 0) return "";
  const i = ((usedCount % slot.angles.length) + slot.angles.length) % slot.angles.length;
  return slot.angles[i];
}
