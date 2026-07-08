import "server-only";
import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings, recordAIUsage } from "@/lib/ai/settings";
import type { Pillar, Daypart } from "@/lib/social/strategy";
import { PILLAR_LABEL } from "@/lib/social/strategy";

/**
 * Generates a unique social post from real catalog data using the existing Groq
 * seam. Mirrors lib/marketing/ai.ts: guards on `aiAvailable()` with a
 * deterministic keyless fallback, uses generateText + a defensive JSON parse
 * (never generateObject — the Groq model lacks json_schema), and returns a typed
 * object. Two safety layers: the system prompt forbids invented nutrition /
 * medical claims, and a post-parse sanitizer strips banned claim words. Recent
 * hooks + hashtags are fed in so successive posts never repeat.
 */

export type SocialProductContext = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string;
  ingredients: string | null;
  benefits: string | null;
  nutritionFacts: { label: string; value: string }[] | null;
  categoryName: string | null;
  brandName: string | null;
  priceLabel: string | null; // sale-aware, formatted e.g. "₹299"
  discountLabel: string | null; // e.g. "20% off" or null
  inStock: boolean;
};

export type GeneratedSocialPost = {
  hook: string;
  caption: string;
  captionLong: string;
  cta: string;
  hashtags: string[];
  altText: string;
  contentHash: string;
};

export type GenerateSocialInput = {
  product: SocialProductContext | null;
  pillar: Pillar;
  daypart: Daypart;
  angle: string;
  brandVoice: string;
  defaultHashtags: string[];
  bannedWords: string[];
  recentHooks?: string[];
  recentHashtags?: string[];
  templateGuidance?: string;
};

const MAX_HASHTAGS = 18;

/** Stable, dependency-free hash (djb2) for uniqueness de-duplication. */
export function contentHash(text: string): string {
  let h = 5381;
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Normalize a raw tag to `#lowercasealnum`. */
function normTag(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N}]/gu, "");
  return cleaned ? `#${cleaned}` : "";
}

function sanitizeHashtags(tags: string[], defaults: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...tags, ...defaults]) {
    const tag = normTag(t);
    const key = tag.toLowerCase();
    if (tag.length > 1 && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

/** Remove banned claim words/phrases from generated copy (health-claim safety). */
export function stripBannedClaims(text: string, banned: string[]): string {
  let out = text;
  for (const word of banned) {
    const w = word.trim();
    if (!w) continue;
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Factual product block for the prompt — DB facts only, nothing invented. */
function productFacts(p: SocialProductContext): string {
  const lines: string[] = [`Product: ${p.name}`];
  if (p.categoryName) lines.push(`Category: ${p.categoryName}`);
  if (p.brandName) lines.push(`Brand: ${p.brandName}`);
  if (p.shortDescription) lines.push(`Short description: ${p.shortDescription}`);
  if (p.description) lines.push(`Description: ${p.description.slice(0, 600)}`);
  if (p.ingredients) lines.push(`Ingredients: ${p.ingredients}`);
  if (p.benefits) lines.push(`Benefits: ${p.benefits}`);
  if (p.nutritionFacts?.length) {
    const nf = p.nutritionFacts
      .slice(0, 12)
      .map((f) => `${f.label}: ${f.value}`)
      .join("; ");
    lines.push(`Nutrition facts (use only these numbers, never invent others): ${nf}`);
  }
  if (p.priceLabel) lines.push(`Price: ${p.priceLabel}${p.discountLabel ? ` (${p.discountLabel})` : ""}`);
  lines.push(`In stock: ${p.inStock ? "yes" : "no"}`);
  return lines.join("\n");
}

/** Deterministic, safe copy when AI is not configured. */
function fallbackPost(input: GenerateSocialInput): GeneratedSocialPost {
  const { product, pillar, angle } = input;
  const name = product?.name ?? "Nutriyet";
  const label = PILLAR_LABEL[pillar];
  const hook = product
    ? `${angle}: ${name}`
    : `${label}: ${angle}`;
  const captionBody = product
    ? `${product.shortDescription || product.description.slice(0, 140)}\n\nClean, wholesome nutrition from Nutriyet — ${name}.`
    : `${angle}. Small, mindful choices add up. Explore clean, wholesome snacking with Nutriyet.`;
  const caption = `${hook}\n\n${captionBody}`;
  const captionLong = `${caption}\n\nAt Nutriyet we keep it simple and honest: quality ingredients, no shortcuts. ${
    product ? `Discover ${name} today.` : "Discover our range today."
  }`;
  const hashtags = sanitizeHashtags(
    [
      "#Nutriyet",
      "#HealthySnacking",
      product?.categoryName ? `#${product.categoryName.replace(/\s+/g, "")}` : "#EatClean",
      "#IndianSnacks",
      "#CleanEating",
    ],
    input.defaultHashtags,
  );
  const altText = product
    ? `${name} from Nutriyet — ${product.categoryName ?? "healthy snack"}.`
    : `Nutriyet — ${label.toLowerCase()} post.`;
  return {
    hook,
    caption: stripBannedClaims(caption, input.bannedWords),
    captionLong: stripBannedClaims(captionLong, input.bannedWords),
    cta: product ? "Shop now" : "Explore Nutriyet",
    hashtags,
    altText,
    contentHash: contentHash(caption),
  };
}

function parsePost(text: string): Partial<GeneratedSocialPost> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")).filter(Boolean) : [];
    if (!str(o.caption) && !str(o.hook)) return null;
    return {
      hook: str(o.hook),
      caption: str(o.caption),
      captionLong: str(o.captionLong) || str(o.caption),
      cta: str(o.cta),
      hashtags: arr(o.hashtags),
      altText: str(o.altText),
    };
  } catch {
    return null;
  }
}

export async function generateSocialPost(
  input: GenerateSocialInput,
): Promise<{ ok: true; data: GeneratedSocialPost } | { ok: false; error: string }> {
  if (!aiAvailable()) {
    return { ok: true, data: fallbackPost(input) };
  }

  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return { ok: true, data: fallbackPost(input) };

  const { pillar, daypart, angle, brandVoice, product } = input;
  const recentHooks = (input.recentHooks ?? []).slice(0, 12);
  const recentHashtags = (input.recentHashtags ?? []).slice(0, 40);

  const system = `You are the social media content lead for Nutriyet, an Indian health & nutrition brand (makhana, dry fruits, seeds, protein, healthy snacks). Brand voice: ${brandVoice}

You write Instagram content that is factual, warm and engaging for an Indian audience.
STRICT RULES:
- Use ONLY the product facts provided. NEVER invent nutrition numbers, ingredients or origins.
- NEVER make medical or disease claims (no "cures", "treats", "prevents", "detox", "clinically proven", guaranteed results). General, well-known healthy-eating ideas are fine.
- Every caption must be UNIQUE — do not reuse any of the recent hooks or hashtags listed.
- Rotate style, emoji usage and CTA phrasing; keep emoji tasteful (0-4).
- Hashtags: mix of brand, niche, and a couple of long-tail. No spam, no banned/irrelevant tags. 8-15 tags.
Respond with ONLY a single minified JSON object, no markdown, using EXACTLY these keys:
{"hook": string, "caption": string, "captionLong": string, "cta": string, "hashtags": string[], "altText": string}
Where: hook <= 80 chars and scroll-stopping; caption is a short Instagram caption (2-5 short lines, may include a line for the hook); captionLong is a longer 3-5 sentence version; cta is 2-5 words; altText describes the image factually for accessibility (<= 120 chars).`;

  const prompt = `Content pillar: ${PILLAR_LABEL[pillar]} (${daypart.toLowerCase()})
Angle for this post: ${angle}
${input.templateGuidance ? `Extra guidance: ${input.templateGuidance}\n` : ""}${
    product ? productFacts(product) : "No specific product — write educational / community content for the brand."
  }

Recent hooks to avoid repeating: ${recentHooks.length ? recentHooks.map((h) => `"${h}"`).join(", ") : "none"}
Recent hashtags to avoid overusing: ${recentHashtags.length ? recentHashtags.join(" ") : "none"}`;

  try {
    const { text, usage } = await generateText({
      model,
      system,
      prompt,
      temperature: Math.min(1, (settings.temperature ?? 0.7) + 0.15),
    });
    const parsed = parsePost(text);
    if (!parsed || !parsed.caption) {
      return { ok: true, data: fallbackPost(input) };
    }
    const caption = stripBannedClaims(parsed.caption, input.bannedWords);
    const data: GeneratedSocialPost = {
      hook: stripBannedClaims(parsed.hook || caption.split("\n")[0] || "", input.bannedWords).slice(0, 120),
      caption,
      captionLong: stripBannedClaims(parsed.captionLong || caption, input.bannedWords),
      cta: (parsed.cta || (product ? "Shop now" : "Explore Nutriyet")).slice(0, 40),
      hashtags: sanitizeHashtags(parsed.hashtags ?? [], input.defaultHashtags),
      altText: (parsed.altText || fallbackPost(input).altText).slice(0, 160),
      contentHash: contentHash(caption),
    };
    await recordAIUsage(usage?.totalTokens ?? 0);
    return { ok: true, data };
  } catch (e) {
    console.error("[social] AI generation failed:", e);
    return { ok: true, data: fallbackPost(input) };
  }
}
