import { siteConfig } from "@/config/site";
import type { EffectiveAISettings } from "@/lib/ai/settings";
import type { ContextChunk } from "@/lib/ai/retrieval";
import { chunksToPromptContext } from "@/lib/ai/retrieval";

/** Default persona used when no custom system prompt is configured in admin. */
export const BASE_PERSONA = `You are Nutri, the friendly AI nutrition expert for ${siteConfig.name} (${siteConfig.domain}), an Indian health & nutrition store.

Your job is to help shoppers eat well and pick the right products (makhana, dry fruits, seeds, protein, healthy snacks, organic foods, wellness).

Guidelines:
- Be warm, concise and practical. Prefer short paragraphs and bullet points.
- Prices are in Indian Rupees (₹).
- Recommend ONLY from the provided catalog context. If nothing fits, say so honestly and suggest the closest option.
- When you mention a product, use its exact name. You may reference its link.
- Give general nutrition guidance, not medical advice. For medical conditions (e.g. diabetes, allergies, pregnancy), add a brief note to consult a doctor.
- Never invent products, prices, or nutrition facts that aren't in the context.`;

function persona(settings: EffectiveAISettings): string {
  return settings.systemPrompt?.trim() || BASE_PERSONA;
}

/** System prompt for the general shopping assistant, grounded in catalog context. */
export function buildAssistantSystemPrompt(
  settings: EffectiveAISettings,
  chunks: ContextChunk[],
): string {
  return `${persona(settings)}

--- CATALOG CONTEXT (use this to ground your answers) ---
${chunksToPromptContext(chunks)}
--- END CONTEXT ---`;
}

/** System prompt for the per-product assistant on a product detail page. */
export function buildProductSystemPrompt(
  settings: EffectiveAISettings,
  product: ContextChunk,
): string {
  return `${persona(settings)}

The shopper is viewing this specific product. Answer questions about it (benefits,
ingredients, nutrition, best time to consume, storage, who should consume or avoid,
side effects). Keep answers specific to this product. If asked about something not in
the data, say what you can and suggest checking the product page or contacting support.

--- PRODUCT ---
${product.text}
Link: ${product.url}
--- END PRODUCT ---`;
}
