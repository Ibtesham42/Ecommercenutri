import { streamText, type ModelMessage } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { DEFAULT_GROQ_MODEL } from "@/lib/groq";
import { buildJnvAssistantSystemPrompt } from "@/lib/jnv/ai-prompts";

export type JnvChatMessage = { role: "user" | "assistant"; content: string };

export type JnvAssistantStream =
  | { ok: true; result: ReturnType<typeof streamText> }
  | { ok: false; reason: "unavailable" };

/**
 * Byte's orchestration — deliberately independent of `lib/ai/chat.ts`
 * (the storefront/Nutri assistant): own system prompt, no product retrieval,
 * no chat-history persistence (the student portal has no login). Reuses only
 * the provider seam (`lib/ai/provider.ts`), which is infra, not branding.
 */
export async function runJnvAssistantStream(opts: {
  messages: JnvChatMessage[];
  classLevel?: number | null;
  contextTitle?: string | null;
  contextText?: string | null;
}): Promise<JnvAssistantStream> {
  if (!aiAvailable()) return { ok: false, reason: "unavailable" };

  const model = getModel(DEFAULT_GROQ_MODEL);
  if (!model) return { ok: false, reason: "unavailable" };

  const system = buildJnvAssistantSystemPrompt({
    classLevel: opts.classLevel,
    contextTitle: opts.contextTitle,
    contextText: opts.contextText,
  });

  const result = streamText({
    model,
    system,
    messages: opts.messages as ModelMessage[],
    temperature: 0.4,
    maxOutputTokens: 1400,
  });

  return { ok: true, result };
}
