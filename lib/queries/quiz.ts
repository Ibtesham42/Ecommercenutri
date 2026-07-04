import "server-only";
import { prisma } from "@/lib/prisma";
import type { QuizBand, QuizRecommendations } from "@/lib/quiz/score";
import type { QuizAnswers } from "@/lib/quiz/questions";

export type MyHealthScore = {
  id: string;
  score: number;
  band: QuizBand;
  answers: QuizAnswers;
  recommendations: QuizRecommendations;
  couponCode: string | null;
  createdAt: string;
};

/** The signed-in user's most recent (claimed) health-score report, or null. */
export async function getMyHealthScore(userId: string): Promise<MyHealthScore | null> {
  try {
    const row = await prisma.healthQuizResult.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return {
      id: row.id,
      score: row.score,
      band: row.band as QuizBand,
      answers: row.answers as unknown as QuizAnswers,
      recommendations: row.recommendations as unknown as QuizRecommendations,
      couponCode: row.couponCode,
      createdAt: row.createdAt.toISOString(),
    };
  } catch (err) {
    console.error("[quiz] getMyHealthScore failed:", err);
    return null;
  }
}
