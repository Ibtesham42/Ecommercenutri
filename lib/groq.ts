import { createGroq } from "@ai-sdk/groq";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { env, isConfigured } from "@/lib/env";

export const groqEnabled = isConfigured.groq();

/** Groq provider (OpenAI-compatible) via the Vercel AI SDK; `null` if no key. */
export const groq = groqEnabled ? createGroq({ apiKey: env.groqApiKey }) : null;

/**
 * Models Groq has decommissioned. The admin AI Settings row (and a stale
 * `GROQ_MODEL` env var) can still name one — Groq then fails every request
 * mid-stream, so remap to the current default instead of trusting the id.
 */
const RETIRED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
]);

const FALLBACK_MODEL = "openai/gpt-oss-120b";

export function resolveGroqModelId(model?: string | null): string {
  const id = model?.trim() || env.groqModel;
  if (!RETIRED_MODELS.has(id)) return id;
  return RETIRED_MODELS.has(env.groqModel) ? FALLBACK_MODEL : env.groqModel;
}

/**
 * Resolve a language model handle for `streamText`/`generateText`.
 * Returns `null` when Groq is not configured so callers can show a friendly
 * "AI not configured" state.
 */
export function getGroqModel(model?: string) {
  if (!groq) return null;
  const id = resolveGroqModelId(model);
  // gpt-oss models reason before answering; at the default effort that
  // reasoning can eat most of a short `maxOutputTokens` budget (and latency).
  if (!id.startsWith("openai/gpt-oss")) return groq(id);
  return wrapLanguageModel({
    model: groq(id),
    middleware: defaultSettingsMiddleware({
      settings: { providerOptions: { groq: { reasoningEffort: "low" } } },
    }),
  });
}

export const DEFAULT_GROQ_MODEL = resolveGroqModelId(env.groqModel);
