import { streamText, type ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { getModel } from "@/lib/ai/provider";
import { getAISettings } from "@/lib/ai/settings";
import { retrieveProductContext, buildProductChunk } from "@/lib/ai/retrieval";
import {
  buildAssistantSystemPrompt,
  buildProductSystemPrompt,
} from "@/lib/ai/prompts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantStream =
  | { ok: true; result: ReturnType<typeof streamText> }
  | { ok: false; reason: "disabled" | "unavailable" | "not_found" };

/**
 * Core assistant orchestration, independent of HTTP transport. Resolves
 * settings + provider, grounds the conversation with retrieved context, and
 * returns a streaming result. The caller supplies an `onFinish` hook for
 * usage metering / history persistence so this stays free of request concerns.
 */
export async function runAssistantStream(opts: {
  messages: ChatMessage[];
  productId?: string | null;
  /** Shopper identity for personalization (quiz goal in the system prompt). */
  userId?: string | null;
  anonId?: string | null;
  onFinish?: (text: string, totalTokens: number) => void | Promise<void>;
}): Promise<AssistantStream> {
  const settings = await getAISettings();
  if (!settings.enabled) return { ok: false, reason: "disabled" };

  const isProduct = Boolean(opts.productId);
  if (isProduct && !settings.productAssistantEnabled) {
    return { ok: false, reason: "disabled" };
  }
  if (!isProduct && !settings.assistantEnabled) {
    return { ok: false, reason: "disabled" };
  }

  const model = getModel(settings.model);
  if (!model) return { ok: false, reason: "unavailable" };

  let system: string;
  if (isProduct) {
    const chunk = await buildProductChunk(opts.productId!);
    if (!chunk) return { ok: false, reason: "not_found" };
    system = buildProductSystemPrompt(settings, chunk);
  } else {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
    const [chunks, quizGoal] = await Promise.all([
      retrieveProductContext(lastUser?.content ?? ""),
      latestQuizGoal(opts.userId, opts.anonId),
    ]);
    system = buildAssistantSystemPrompt(settings, chunks, { quizGoal });
  }

  const result = streamText({
    model,
    system,
    messages: opts.messages as ModelMessage[],
    temperature: settings.temperature,
    maxOutputTokens: settings.maxTokens,
    onFinish: async ({ text, usage }) => {
      await opts.onFinish?.(text, usage?.totalTokens ?? 0);
    },
  });

  return { ok: true, result };
}

/** Most recent health-quiz goal for this shopper (null when none / on error). */
async function latestQuizGoal(
  userId?: string | null,
  anonId?: string | null,
): Promise<string | null> {
  if (!userId && !anonId) return null;
  try {
    const row = await prisma.healthQuizResult.findFirst({
      where: userId ? { userId } : { anonId: anonId! },
      orderBy: { createdAt: "desc" },
      select: { answers: true },
    });
    const answers = (row?.answers ?? {}) as Record<string, string>;
    return answers.goal ?? null;
  } catch {
    return null;
  }
}
