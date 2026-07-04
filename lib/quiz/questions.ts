/**
 * "Discover Your Nutriyet Health Score" quiz definition (client-safe — no server
 * imports, so the quiz UI can render it directly). Six quick questions, each
 * option carrying a `points` weight toward a 0–100 score and optional `tags`
 * used for personalized product focus. Keep this the single source of truth;
 * scoring (lib/quiz/score.ts) and validation (lib/validations/quiz.ts) derive
 * from it.
 */

export type QuizKey = "goal" | "age" | "exercise" | "snack" | "spice" | "water";

export type QuizOption = {
  value: string;
  label: string;
  emoji: string;
  points: number;
  tags?: string[];
};

export type QuizQuestion = {
  id: QuizKey;
  question: string;
  help?: string;
  options: QuizOption[];
};

export type QuizAnswers = Record<QuizKey, string>;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "goal",
    question: "What's your main health goal?",
    help: "We'll tailor your recommendations to this.",
    options: [
      { value: "weight_loss", label: "Weight loss", emoji: "🔥", points: 8, tags: ["makhana", "seeds", "low-calorie"] },
      { value: "muscle", label: "Build muscle", emoji: "💪", points: 10, tags: ["protein", "nuts"] },
      { value: "energy", label: "More energy", emoji: "⚡", points: 9, tags: ["dry-fruits", "seeds"] },
      { value: "immunity", label: "Boost immunity", emoji: "🛡️", points: 10, tags: ["dry-fruits", "seeds"] },
      { value: "wellness", label: "General wellness", emoji: "🌿", points: 12, tags: ["makhana", "dry-fruits"] },
      { value: "gut", label: "Better digestion", emoji: "🌾", points: 11, tags: ["seeds", "fibre"] },
    ],
  },
  {
    id: "age",
    question: "Which age group are you in?",
    options: [
      { value: "under_18", label: "Under 18", emoji: "🧒", points: 12 },
      { value: "18_29", label: "18–29", emoji: "🧑", points: 14 },
      { value: "30_44", label: "30–44", emoji: "👨", points: 12 },
      { value: "45_59", label: "45–59", emoji: "🧔", points: 10 },
      { value: "60_plus", label: "60+", emoji: "👴", points: 9 },
    ],
  },
  {
    id: "exercise",
    question: "How often do you exercise?",
    options: [
      { value: "rarely", label: "Rarely", emoji: "🛋️", points: 4 },
      { value: "1_2", label: "1–2× a week", emoji: "🚶", points: 10 },
      { value: "3_4", label: "3–4× a week", emoji: "🏃", points: 16 },
      { value: "5_plus", label: "5+× a week", emoji: "🏋️", points: 20 },
      { value: "daily", label: "Every day", emoji: "🔁", points: 22 },
    ],
  },
  {
    id: "snack",
    question: "Your go-to snack right now?",
    options: [
      { value: "fried", label: "Chips / fried", emoji: "🍟", points: 2, tags: ["makhana", "roasted"] },
      { value: "sweet", label: "Sweets / mithai", emoji: "🍬", points: 5, tags: ["dry-fruits", "dates"] },
      { value: "chocolate", label: "Chocolate", emoji: "🍫", points: 6, tags: ["dry-fruits", "nuts"] },
      { value: "nuts", label: "Nuts & seeds", emoji: "🥜", points: 20, tags: ["nuts", "seeds"] },
      { value: "fruit", label: "Fresh fruit", emoji: "🍎", points: 18, tags: ["dry-fruits"] },
      { value: "roasted", label: "Roasted / baked", emoji: "🌰", points: 15, tags: ["makhana", "roasted"] },
    ],
  },
  {
    id: "spice",
    question: "How do you like your flavours?",
    options: [
      { value: "mild", label: "Mild", emoji: "🥛", points: 8 },
      { value: "medium", label: "Medium", emoji: "🌶️", points: 10 },
      { value: "spicy", label: "Spicy", emoji: "🔥", points: 9 },
      { value: "very_spicy", label: "Extra spicy", emoji: "🌋", points: 7 },
    ],
  },
  {
    id: "water",
    question: "How much water do you drink daily?",
    options: [
      { value: "lt_1l", label: "Less than 1L", emoji: "💧", points: 3 },
      { value: "1_2l", label: "1–2 litres", emoji: "🚰", points: 10 },
      { value: "2_3l", label: "2–3 litres", emoji: "💦", points: 18 },
      { value: "3l_plus", label: "3+ litres", emoji: "🌊", points: 22 },
    ],
  },
];

export const QUIZ_KEYS: QuizKey[] = QUIZ_QUESTIONS.map((q) => q.id);

/** Allowed option values per question — used by scoring + Zod validation. */
export const QUIZ_ALLOWED: Record<QuizKey, string[]> = Object.fromEntries(
  QUIZ_QUESTIONS.map((q) => [q.id, q.options.map((o) => o.value)]),
) as Record<QuizKey, string[]>;

export function quizOption(key: QuizKey, value: string): QuizOption | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === key)?.options.find((o) => o.value === value);
}

/** Human label for a chosen answer (for the saved report / dashboard). */
export function quizAnswerLabel(key: QuizKey, value: string): string {
  return quizOption(key, value)?.label ?? value;
}

export function quizQuestionLabel(key: QuizKey): string {
  return QUIZ_QUESTIONS.find((q) => q.id === key)?.question ?? key;
}
