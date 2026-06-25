import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/** Effective AI configuration: DB settings merged with environment defaults. */
export type EffectiveAISettings = {
  enabled: boolean;
  assistantEnabled: boolean;
  searchEnabled: boolean;
  productAssistantEnabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
};

const FALLBACK: EffectiveAISettings = {
  enabled: true,
  assistantEnabled: true,
  searchEnabled: true,
  productAssistantEnabled: true,
  model: "",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: null,
};

/**
 * Read the single-row AISetting and fold in env defaults. Resilient: if the
 * settings row is missing or the DB is briefly unreachable, returns safe
 * defaults so AI features never hard-crash a page.
 */
export async function getAISettings(): Promise<EffectiveAISettings> {
  try {
    const s = await prisma.aISetting.findUnique({ where: { id: "singleton" } });
    return {
      enabled: s?.isEnabled ?? FALLBACK.enabled,
      assistantEnabled: s?.assistantEnabled ?? FALLBACK.assistantEnabled,
      searchEnabled: s?.searchEnabled ?? FALLBACK.searchEnabled,
      productAssistantEnabled:
        s?.productAssistantEnabled ?? FALLBACK.productAssistantEnabled,
      model: s?.model || env.groqModel,
      temperature: s?.temperature ?? FALLBACK.temperature,
      maxTokens: s?.maxTokens ?? FALLBACK.maxTokens,
      systemPrompt: s?.systemPrompt ?? null,
    };
  } catch {
    return { ...FALLBACK, model: env.groqModel };
  }
}

/** Increment usage counters. Best-effort — never throws into a request. */
export async function recordAIUsage(totalTokens: number): Promise<void> {
  try {
    await prisma.aISetting.update({
      where: { id: "singleton" },
      data: {
        totalRequests: { increment: 1 },
        totalTokens: { increment: Math.max(0, Math.round(totalTokens)) },
      },
    });
  } catch {
    /* settings row may not exist yet; ignore */
  }
}
