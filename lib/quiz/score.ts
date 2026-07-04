import { QUIZ_KEYS, quizOption, quizAnswerLabel, type QuizAnswers, type QuizKey } from "@/lib/quiz/questions";

/**
 * Pure, deterministic quiz scoring + rule-based recommendations (client-safe, no
 * server imports). The score is an engagement/wellness indicator (0–100), NOT
 * medical advice. An optional AI pass (in the server action) can rewrite the
 * `summary` prose, but this always produces a complete, honest result on its
 * own so the quiz works with no AI key.
 */

export type QuizBand = "Thriving" | "Balanced" | "Getting Started";

export type QuizFocus = { label: string; href: string };

export type QuizRecommendations = {
  summary: string;
  tips: string[];
  focus: QuizFocus[];
};

export type QuizResult = {
  score: number;
  band: QuizBand;
  recommendations: QuizRecommendations;
};

// Tag → a friendly focus label + a storefront search link (uses existing search).
const FOCUS_MAP: Record<string, QuizFocus> = {
  makhana: { label: "Makhana (fox nuts)", href: "/search?q=makhana" },
  seeds: { label: "Seeds (chia, flax, pumpkin)", href: "/search?q=seeds" },
  nuts: { label: "Nuts & trail mixes", href: "/search?q=nuts" },
  protein: { label: "Protein & high-protein snacks", href: "/search?q=protein" },
  "dry-fruits": { label: "Dry fruits", href: "/search?q=dry+fruits" },
  dates: { label: "Dates", href: "/search?q=dates" },
  roasted: { label: "Roasted & baked snacks", href: "/search?q=roasted" },
  fibre: { label: "High-fibre foods", href: "/search?q=fibre" },
  "low-calorie": { label: "Light, low-calorie snacks", href: "/search?q=makhana" },
};

export function scoreBand(score: number): QuizBand {
  if (score >= 75) return "Thriving";
  if (score >= 50) return "Balanced";
  return "Getting Started";
}

/** Compute the score, band and rule-based recommendations from answers. */
export function scoreQuiz(answers: QuizAnswers): QuizResult {
  let raw = 0;
  for (const key of QUIZ_KEYS) {
    raw += quizOption(key, answers[key])?.points ?? 0;
  }
  // The point weights are tuned so a maxed-out set lands near 100; clamp for safety.
  const score = Math.max(1, Math.min(100, Math.round(raw)));
  const band = scoreBand(score);

  // Focus products: union of the tags on the chosen goal + snack (deduped, capped).
  const tags = new Set<string>();
  for (const key of ["goal", "snack"] as QuizKey[]) {
    for (const t of quizOption(key, answers[key])?.tags ?? []) tags.add(t);
  }
  const focus: QuizFocus[] = [];
  for (const t of tags) {
    if (FOCUS_MAP[t] && !focus.some((f) => f.label === FOCUS_MAP[t].label)) focus.push(FOCUS_MAP[t]);
    if (focus.length >= 3) break;
  }

  const tips = buildTips(answers, band);
  const summary = buildSummary(answers, score, band);
  return { score, band, recommendations: { summary, tips, focus } };
}

function buildTips(answers: QuizAnswers, band: QuizBand): string[] {
  const tips: string[] = [];
  if (answers.water === "lt_1l" || answers.water === "1_2l") {
    tips.push("Aim for 2–3 litres of water a day — hydration is the easiest win for energy and digestion.");
  }
  if (answers.snack === "fried" || answers.snack === "sweet" || answers.snack === "chocolate") {
    tips.push("Swap one daily snack for roasted makhana or a handful of nuts — same crunch, far better nutrition.");
  }
  if (answers.exercise === "rarely" || answers.exercise === "1_2") {
    tips.push("Add a 20-minute daily walk — pairing light movement with better snacking compounds fast.");
  }
  switch (answers.goal) {
    case "weight_loss":
      tips.push("Choose high-fibre, low-calorie snacks like makhana to stay full between meals.");
      break;
    case "muscle":
      tips.push("Add a protein-rich snack after workouts — nuts, seeds and protein mixes help recovery.");
      break;
    case "energy":
      tips.push("Keep dates and a small dry-fruit mix handy for a clean afternoon energy lift.");
      break;
    case "immunity":
      tips.push("Rotate a variety of nuts and seeds — the mix of nutrients supports immunity year-round.");
      break;
    case "gut":
      tips.push("Work in chia and flax seeds gradually for gentle, fibre-led digestive support.");
      break;
    default:
      tips.push("A varied mix of nuts, seeds and makhana covers most everyday nutrition needs.");
  }
  if (band === "Thriving") {
    tips.push("You're already doing great — small, consistent choices will keep your streak going.");
  }
  return tips.slice(0, 4);
}

function buildSummary(answers: QuizAnswers, score: number, band: QuizBand): string {
  const goal = quizAnswerLabel("goal", answers.goal).toLowerCase();
  const lead =
    band === "Thriving"
      ? `Excellent — a health score of ${score} puts you in great shape.`
      : band === "Balanced"
        ? `Solid start — your health score is ${score}, with clear room to level up.`
        : `Your health score is ${score} — a few simple changes will move the needle quickly.`;
  return `${lead} Based on your focus on ${goal}, we've picked snacks and habits below that fit your routine.`;
}
