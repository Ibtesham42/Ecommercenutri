import { createGroq } from "@ai-sdk/groq";
import { env, isConfigured } from "@/lib/env";

export const groqEnabled = isConfigured.groq();

/** Groq provider (OpenAI-compatible) via the Vercel AI SDK; `null` if no key. */
export const groq = groqEnabled ? createGroq({ apiKey: env.groqApiKey }) : null;

/**
 * Resolve a language model handle for `streamText`/`generateText`.
 * Returns `null` when Groq is not configured so callers can show a friendly
 * "AI not configured" state.
 */
export function getGroqModel(model?: string) {
  if (!groq) return null;
  return groq(model ?? env.groqModel);
}

export const DEFAULT_GROQ_MODEL = env.groqModel;
