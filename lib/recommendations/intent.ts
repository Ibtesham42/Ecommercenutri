/** Intent → catalog keywords. Lets searches like "weight loss" surface relevant
 *  products (flax, chia, makhana, pumpkin seeds…) even with no AI key. Pure (no
 *  DB / no imports) so it's safe to use anywhere. Extend with more goals freely. */

type IntentEntry = { triggers: string[]; terms: string[] };

const INTENT_MAP: IntentEntry[] = [
  {
    triggers: ["weight loss", "fat loss", "lose weight", "slim", "diet", "low calorie"],
    terms: ["flax", "chia", "makhana", "pumpkin seed", "sunflower seed", "oats", "green tea"],
  },
  {
    triggers: ["high protein", "protein", "muscle", "gym", "bodybuilding", "workout"],
    terms: ["protein", "peanut", "almond", "soy", "seeds", "chana", "pumpkin seed"],
  },
  {
    triggers: ["immunity", "immune", "cold", "cough", "antioxidant"],
    terms: ["amla", "turmeric", "ginger", "tulsi", "nuts", "seeds", "berries"],
  },
  {
    triggers: ["breakfast", "morning", "cereal"],
    terms: ["oats", "muesli", "makhana", "almond", "dry fruit", "seeds", "granola"],
  },
  {
    triggers: ["energy", "stamina", "fatigue", "tired"],
    terms: ["dates", "almond", "cashew", "raisin", "seeds", "jaggery"],
  },
  {
    triggers: ["heart", "cholesterol", "bp", "blood pressure"],
    terms: ["walnut", "flax", "oats", "almond", "seeds"],
  },
  {
    triggers: ["skin", "hair", "glow", "beauty"],
    terms: ["almond", "walnut", "seeds", "amla", "flax"],
  },
  {
    triggers: ["diabetic", "diabetes", "sugar free", "blood sugar"],
    terms: ["makhana", "flax", "fenugreek", "methi", "nuts", "seeds"],
  },
  {
    triggers: ["pregnancy", "pregnant", "iron"],
    terms: ["dates", "almond", "raisin", "seeds", "dry fruit"],
  },
];

/** Catalog search terms implied by a goal-oriented query (deduped). */
export function expandSearchTerms(query: string): string[] {
  const q = query.toLowerCase();
  const terms = new Set<string>();
  for (const entry of INTENT_MAP) {
    if (entry.triggers.some((t) => q.includes(t))) {
      entry.terms.forEach((x) => terms.add(x));
    }
  }
  return [...terms];
}

/** Whether a query maps to a known wellness intent (for UI copy). */
export function hasIntent(query: string): boolean {
  return expandSearchTerms(query).length > 0;
}
