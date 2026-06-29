import "server-only";
import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings } from "@/lib/ai/settings";

export type GeneratedContent = { title: string; body: string; ctaText: string };

/**
 * Draft campaign copy from a short brief using the existing Groq seam. Falls back
 * to a deterministic heuristic when AI isn't configured, so the editor always
 * returns something usable. Uses generateText + JSON parse (not generateObject —
 * the Groq model doesn't support json_schema; see CLAUDE.md §13).
 */
export async function generateCampaignContent(input: {
  prompt: string;
  tone?: string;
  channel?: string;
}): Promise<{ ok: true; data: GeneratedContent } | { ok: false; error: string }> {
  const brief = input.prompt?.trim();
  if (!brief) return { ok: false, error: "Describe the campaign first." };

  if (!aiAvailable()) {
    return {
      ok: true,
      data: {
        title: brief.length > 56 ? `${brief.slice(0, 53)}…` : brief,
        body: `${brief}\n\nShop clean, healthy nutrition at Nutriyet — makhana, dry fruits, seeds and more.`,
        ctaText: "Shop now",
      },
    };
  }

  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return { ok: false, error: "AI is not configured." };

  const system = `You are a senior marketing copywriter for Nutriyet, an Indian health & nutrition e-commerce brand (makhana, dry fruits, seeds, protein, healthy snacks). Write concise, warm, conversion-focused campaign copy for Indian customers. Respond with ONLY a single minified JSON object, no markdown, using exactly these keys:
{"title": string, "body": string, "ctaText": string}
Rules: title <= 60 characters and punchy; body is 1-3 short paragraphs separated by a blank line; ctaText is 2-4 words. Do not invent specific prices or discounts unless given.`;
  const prompt = `Campaign brief: ${brief}${input.tone ? `\nTone: ${input.tone}` : ""}${input.channel ? `\nPrimary channel: ${input.channel}` : ""}`;

  try {
    const { text } = await generateText({ model, system, prompt, temperature: settings.temperature });
    const parsed = parseContent(text);
    if (!parsed) return { ok: false, error: "Couldn't read the AI response — try again." };
    return { ok: true, data: parsed };
  } catch (e) {
    console.error("[marketing] AI generation failed:", e);
    return { ok: false, error: "AI generation failed. Please try again." };
  }
}

function parseContent(text: string): GeneratedContent | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof o.title === "string" && typeof o.body === "string") {
      return {
        title: o.title.slice(0, 80),
        body: o.body,
        ctaText: typeof o.ctaText === "string" && o.ctaText ? o.ctaText : "Shop now",
      };
    }
    return null;
  } catch {
    return null;
  }
}
