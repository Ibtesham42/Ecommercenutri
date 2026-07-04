import { z } from "zod";
import { QUIZ_ALLOWED, type QuizKey } from "@/lib/quiz/questions";

/**
 * Zod schema for quiz answers — each key must be one of that question's allowed
 * option values (derived from the single-source question list), so the score
 * can't be gamed with crafted input. Uses `refine` (not `z.enum`) so it doesn't
 * depend on the derived arrays being literal tuples.
 */
const answerField = (key: QuizKey) =>
  z.string().refine((v) => QUIZ_ALLOWED[key].includes(v), { message: "Please answer all questions" });

export const quizAnswersSchema = z.object({
  goal: answerField("goal"),
  age: answerField("age"),
  exercise: answerField("exercise"),
  snack: answerField("snack"),
  spice: answerField("spice"),
  water: answerField("water"),
});

export type QuizAnswersInput = z.infer<typeof quizAnswersSchema>;
