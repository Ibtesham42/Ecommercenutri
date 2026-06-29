"use server";

import { requirePermission } from "@/lib/auth";
import { getBusinessIntelligence } from "@/lib/queries/bi";
import { answerBusinessQuestion } from "@/lib/ai/insights";

export type AskResult = { ok: true; text: string; ai: boolean } | { ok: false; error: string };

/** Answer an admin business question, grounded in the current BI snapshot. */
export async function askBusinessQuestion(question: unknown): Promise<AskResult> {
  await requirePermission("ai");
  if (typeof question !== "string" || question.trim().length < 2) {
    return { ok: false, error: "Type a question first." };
  }
  if (question.length > 300) return { ok: false, error: "Question is too long." };
  try {
    const bi = await getBusinessIntelligence();
    const ans = await answerBusinessQuestion(question, bi);
    return { ok: true, text: ans.text, ai: ans.ai };
  } catch (err) {
    console.error("[admin/insights] ask failed:", err);
    return { ok: false, error: "Couldn't analyze that right now." };
  }
}
