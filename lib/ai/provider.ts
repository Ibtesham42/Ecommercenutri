import type { LanguageModel } from "ai";
import { getGroqModel } from "@/lib/groq";
import { isConfigured } from "@/lib/env";

/**
 * Provider-agnostic seam for the LLM. Today only Groq is wired, but adding
 * OpenAI / Anthropic / Gemini later is a matter of registering another adapter
 * here — no caller changes. The active provider is a single constant.
 */
export type AIProviderId = "groq"; // future: | "openai" | "anthropic" | "google"

export const AI_PROVIDER: AIProviderId = "groq";

type ProviderAdapter = {
  /** Whether this provider has the credentials it needs to run. */
  isConfigured: () => boolean;
  /** Resolve a chat-capable model handle, or null if unavailable. */
  model: (modelId: string) => LanguageModel | null;
};

const adapters: Record<AIProviderId, ProviderAdapter> = {
  groq: {
    isConfigured: () => isConfigured.groq(),
    model: (modelId) => getGroqModel(modelId),
  },
};

/** Is the active AI provider configured (has an API key)? */
export function aiAvailable(provider: AIProviderId = AI_PROVIDER): boolean {
  return adapters[provider]?.isConfigured() ?? false;
}

/** Resolve a model handle for the active provider, or null when not configured. */
export function getModel(
  modelId: string,
  provider: AIProviderId = AI_PROVIDER,
): LanguageModel | null {
  const adapter = adapters[provider];
  if (!adapter || !adapter.isConfigured()) return null;
  return adapter.model(modelId);
}
