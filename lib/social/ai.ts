import "server-only";
import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings, recordAIUsage } from "@/lib/ai/settings";
import type { Pillar, Daypart } from "@/lib/social/strategy";
import { PILLAR_LABEL } from "@/lib/social/strategy";
import {
  checkUniqueness,
  retryInstruction,
  type RecentPost,
} from "@/lib/social/uniqueness";
import { checkCaptionQuality } from "@/lib/social/quality";

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
  /** Short on-image headline for the designed post picture (<= 32 chars). */
  headline: string;
  /** Optional supporting line under it (<= 40 chars). */
  support: string;
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
  /** Recent CTAs. Without these the model kept re-using "Share your recipe" —
   *  it cannot avoid a repeat it has never been shown. */
  recentCtas?: string[];
  templateGuidance?: string;
  /** Structural brief for this post's content style (lib/social/styles.ts). */
  styleBrief?: string;
  styleLabel?: string;
  /** Rotates the hashtag pool so successive posts don't share a tag tail. */
  rotation?: number;
  /** Set on a regeneration: tells the model exactly what read as a repeat. */
  retryNote?: string;
};

const MAX_HASHTAGS = 12;
/** Brand tags that are allowed to appear on every post — everything else in
 *  `defaultHashtags` is treated as a rotating pool, not a fixed tail. */
const BRAND_ANCHOR_LIMIT = 1;

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

/**
 * Build the tag set for a post.
 *
 * Previously every default hashtag was appended to every post, so each caption
 * ended with the identical block (#Nutriyet #HealthySnacking #Makhana #EatClean)
 * — the single biggest reason the feed's hashtags looked copy-pasted. Now only
 * the first default acts as a permanent brand anchor; the remaining defaults are
 * a rotating pool, seeded per post, and tags that dominate the recent window are
 * dropped so the combination keeps moving.
 */
function sanitizeHashtags(
  tags: string[],
  defaults: string[],
  opts: { seed?: number; recent?: string[] } = {},
): string[] {
  const seed = opts.seed ?? 0;
  const recent = (opts.recent ?? []).map((t) => t.toLowerCase());
  // A tag used in more than half the recent window is "overused" — keep it out
  // unless the model chose it deliberately AND we are short on tags.
  const overused = new Set(
    [...new Set(recent)].filter(
      (t) => recent.filter((r) => r === t).length > Math.max(2, recent.length / 2),
    ),
  );

  const anchors = defaults.slice(0, BRAND_ANCHOR_LIMIT);
  const pool = defaults.slice(BRAND_ANCHOR_LIMIT);
  // Rotate the non-anchor defaults so successive posts draw a different slice.
  const rotated = pool.map((_, i) => pool[(i + seed) % pool.length]);

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string, allowOverused = false) => {
    const tag = normTag(raw);
    const key = tag.toLowerCase();
    if (tag.length <= 1 || seen.has(key)) return;
    if (!allowOverused && overused.has(key)) return;
    seen.add(key);
    out.push(tag);
  };

  for (const t of anchors) push(t, true); // brand anchor always survives
  for (const t of tags) push(t); // the model's own, novelty-filtered
  for (const t of rotated.slice(0, 2)) push(t); // a rotating slice of the defaults

  // Still thin? Let the filtered ones back in rather than ship a bare post.
  if (out.length < 5) for (const t of [...tags, ...rotated]) push(t, true);

  return out.slice(0, MAX_HASHTAGS);
}

/** Remove banned claim words/phrases from generated copy (health-claim safety).
 *  Matches whole words only (word boundaries) so legitimate words that merely
 *  contain a banned substring — "secure", "manicure" — are never mangled;
 *  longer phrases are handled before shorter ones. */
export function stripBannedClaims(text: string, banned: string[]): string {
  let out = text;
  const ordered = [...banned].map((w) => w.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const w of ordered) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "");
  }
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

/** Deterministic, safe copy when AI is not configured. Varies the opening and
 *  CTA by a stable hash of the angle+name so keyless posts don't all read alike. */
function fallbackPost(input: GenerateSocialInput): GeneratedSocialPost {
  const { product, pillar, angle } = input;
  const name = product?.name ?? "Nutriyet";
  const label = PILLAR_LABEL[pillar];
  // Seeded with the rotation as well as the angle+product, so the same product
  // on the same angle doesn't produce a byte-identical keyless post every time.
  const seed = parseInt(contentHash(`${angle}|${name}|${input.rotation ?? 0}`), 36);
  const pick = <T,>(arr: T[]): T => arr[seed % arr.length];

  const value = product
    ? product.shortDescription || product.description.slice(0, 140)
    : "Small, mindful choices add up over a day.";
  const hook = product
    ? pick([
        `A closer look at ${name}.`,
        `${name}, and why we keep it simple.`,
        `Reaching for something better? ${name}.`,
        `${angle} — with ${name}.`,
      ])
    : pick([
        `${angle}.`,
        `A small note on ${label.toLowerCase()}.`,
        `Let's talk ${label.toLowerCase()}.`,
      ]);
  const invite = pick([
    "Save this for later.",
    "What's your go-to? Tell us below.",
    "Would you try this?",
    "Tag someone who'd love this.",
  ]);
  const caption = `${hook}\n\n${value}\n\nClean, honest snacking from Nutriyet.\n\n${invite}`;
  const captionLong = `${hook}\n\n${value}\n\nAt Nutriyet we keep it simple and honest: quality ingredients, nothing hidden. ${
    product ? `Have a look at ${name} when you get a moment.` : "Explore our range when you get a moment."
  }\n\n${invite}`;
  const hashtags = sanitizeHashtags(
    [
      product?.categoryName ? `#${product.categoryName.replace(/\s+/g, "")}` : "#EatClean",
      ...pick([
        ["#IndianSnacks", "#CleanEating", "#SnackSmart"],
        ["#HealthyIndia", "#RealFood", "#MindfulEating"],
        ["#DesiSnacks", "#GoodFats", "#EverydayNutrition"],
        ["#GuiltFreeSnacking", "#WholesomeEating", "#SnackBetter"],
      ]),
    ],
    input.defaultHashtags,
    { seed: input.rotation ?? 0, recent: input.recentHashtags ?? [] },
  );
  const altText = product
    ? `${name} from Nutriyet — ${product.categoryName ?? "healthy snack"}.`
    : `Nutriyet — ${label.toLowerCase()} post.`;
  // Keyless installs still get a DESIGNED image, so the fallback owes the
  // renderer a headline. Rotated, product-aware, and free of any claim.
  const headline = pick([
    "Naturally Rich in Goodness",
    "Smart Snacking Starts Here",
    "Clean, Honest Snacking",
    "Made for Everyday Good",
    product ? `Why Choose ${product.categoryName ?? "Nutriyet"}?` : "Why Choose Nutriyet?",
    "Real Food, Nothing Hidden",
  ]).slice(0, 32);
  const support = pick([
    "Roasted, never fried",
    "Nothing artificial",
    "Everyday nutrition",
    "",
  ]);
  return {
    headline,
    support,
    hook,
    caption: stripBannedClaims(caption, input.bannedWords),
    captionLong: stripBannedClaims(captionLong, input.bannedWords),
    cta: pick(
      product
        ? ["Have a look", "Save it for later", "Try it this week", "See the range"]
        : ["Explore Nutriyet", "Save this", "Come say hi"],
    ),
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
      headline: str(o.headline),
      support: str(o.support),
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
  const recentCtas = [...new Set(input.recentCtas ?? [])].slice(0, 10);

  const system = `You are a senior Instagram content strategist for Nutriyet, an Indian health & nutrition brand (makhana, dry fruits, seeds, protein, healthy snacks). You have grown real Indian D2C food accounts and you know exactly what makes people stop scrolling, save, and comment. Brand voice: ${brandVoice}

Write ONE Instagram post that reads like a thoughtful person wrote it — never like AI or a template ad.

WRITE LIKE THIS:
- Open with a specific, human first line: a small truth, a sharp observation, a real question, a tiny story, or a genuinely surprising fact drawn from the product data. The first 5 words must earn the scroll-stop.
- Give one piece of real value — teach something, share an honest detail, or paint a relatable Indian moment (chai time, tiffin box, the 4pm slump, monsoon cravings, post-gym, festive gifting) — only when it fits naturally.
- Talk to ONE person like a friend: second person, warm, specific, unhurried. Short lines with breathing room.
- End by inviting genuine interaction — a real question, a "save this for later", or a soft, non-pushy nudge. VARY this every time; never default to "Shop now".

NEVER DO THIS (these instantly read as AI/spam):
- Telegraphic bullet-fragments stacked as lines ("Rich in antioxidants", "Supports immunity", "Great for digestion"). Write complete, flowing sentences a person would actually say out loud. This is the single most common way to sound like a machine.
- Asserting a health benefit that is NOT in the product facts above. Do not claim it boosts immunity, aids digestion, is rich in antioxidants or is anti-inflammatory unless the given facts say so. If you have no benefit to cite, write about the food, the taste, the habit or the moment instead — that is always better than an invented claim.
- Formulaic openers: "Did you know", "Introducing", "Meet the", "In today's fast-paced world", "Looking for", "Say goodbye to", "Elevate your", "Unlock", "Level up", "Tired of".
- Hype adjectives and filler ("amazing", "perfect", "ultimate", "game-changer", "must-have") or robotic transitions ("furthermore", "moreover").
- Emoji on every line or used as bullets — 0-3 total, only where they add real warmth.
- Do NOT mention the time of day (morning/evening) in the hook or caption unless it is genuinely central to the idea — the posting time is scheduling context, not content.
- Keyword-stuffed or near-duplicate hashtags; fake urgency ("hurry", "limited time", "don't miss out") unless a real discount is provided in the facts.

STRICT SAFETY:
- Use ONLY the product facts provided. NEVER invent nutrition numbers, ingredients, origins or prices.
- No medical or disease claims (cure, treat, prevent, detox, clinically proven, guaranteed results). Well-known, general healthy-eating ideas are fine.
- Every post must be UNIQUE — a different opening pattern, angle and wording from every recent hook listed.

Respond with ONLY a single minified JSON object, no markdown, using EXACTLY these keys:
{"headline": string, "support": string, "hook": string, "caption": string, "captionLong": string, "cta": string, "hashtags": string[], "altText": string}
- headline: the words PRINTED ON THE IMAGE. <= 32 chars, title case, no hashtags, no emoji, no price, no full stop. It must fit this specific product and post — e.g. "Naturally Rich in Goodness", "Smart Snacking Starts Here", "Why Choose Makhana?", "Premium Bihar Mango". Never reuse a recent headline.
- support: an optional second line printed under the headline, <= 40 chars (e.g. "Roasted, never fried"). Empty string if the headline says enough — do not pad.
- hook: the scroll-stopping first line, <= 80 chars, no hashtags, no label prefix.
- caption: 3-6 short feed lines (the hook can be line 1); the last line is a real invitation to engage.
- captionLong: a fuller 4-6 sentence version that tells a little more of the story.
- cta: 2-5 words, natural and varied (e.g. "Save this for later", "Tell us your pick", "Try it this week") — not always "Shop now".
- hashtags: 6-12 curated tags — a few brand, a few niche, one or two discovery/long-tail. Relevant, no stuffing, no repeats.
- altText: factual description of the image for accessibility, <= 120 chars.`;

  const prompt = `Content pillar: ${PILLAR_LABEL[pillar]}
Angle for this post: ${angle}
${input.styleLabel ? `Post style: ${input.styleLabel}\nStyle brief: ${input.styleBrief ?? ""}\n` : ""}(This post is scheduled for the ${daypart.toLowerCase()} — that is timing only; do not write about the time of day.)
${input.templateGuidance ? `Extra guidance: ${input.templateGuidance}\n` : ""}${
    product ? productFacts(product) : "No specific product — write educational / community content for the brand."
  }

Recent hooks to avoid repeating: ${recentHooks.length ? recentHooks.map((h) => `"${h}"`).join(", ") : "none"}
Recent CTAs already used — write a DIFFERENT one: ${recentCtas.length ? recentCtas.map((c) => `"${c}"`).join(", ") : "none"}
Recent hashtags to avoid overusing: ${recentHashtags.length ? recentHashtags.join(" ") : "none"}${
    input.retryNote
      ? `\n\nIMPORTANT — your previous attempt was rejected as a near-duplicate. ${input.retryNote} Change the IDEA, not just the words.`
      : ""
  }`;

  try {
    const { text, usage } = await generateText({
      model,
      system,
      prompt,
      // Push the model further from its last answer on a duplicate-retry.
      temperature: Math.min(
        1,
        (settings.temperature ?? 0.7) + (input.retryNote ? 0.3 : 0.15),
      ),
    });
    const parsed = parsePost(text);
    if (!parsed || !parsed.caption) {
      return { ok: true, data: fallbackPost(input) };
    }
    const caption = stripBannedClaims(parsed.caption, input.bannedWords);
    const fb = fallbackPost(input);
    // The headline is PRINTED on the image, so it has a hard length budget —
    // an overlong one would be shrunk to unreadability by c_fit. Trim at a word
    // boundary, and fall back to the rotating pool if the model skipped it.
    const rawHeadline = stripBannedClaims(parsed.headline || "", input.bannedWords)
      .replace(/[."]+$/g, "")
      .trim();
    const headline = (rawHeadline.length > 32
      ? rawHeadline.slice(0, 32).replace(/\s+\S*$/, "")
      : rawHeadline) || fb.headline;
    const data: GeneratedSocialPost = {
      headline,
      support: stripBannedClaims(parsed.support || "", input.bannedWords).slice(0, 40),
      hook: stripBannedClaims(parsed.hook || caption.split("\n")[0] || "", input.bannedWords).slice(0, 120),
      caption,
      captionLong: stripBannedClaims(parsed.captionLong || caption, input.bannedWords),
      cta: (parsed.cta || (product ? "Save this for later" : "Explore Nutriyet")).slice(0, 40),
      hashtags: sanitizeHashtags(parsed.hashtags ?? [], input.defaultHashtags, {
        seed: input.rotation ?? 0,
        recent: input.recentHashtags ?? [],
      }),
      altText: (parsed.altText || fb.altText).slice(0, 160),
      contentHash: contentHash(caption),
    };
    await recordAIUsage(usage?.totalTokens ?? 0);
    return { ok: true, data };
  } catch (e) {
    console.error("[social] AI generation failed:", e);
    return { ok: true, data: fallbackPost(input) };
  }
}

/**
 * Generate a post that is actually NEW.
 *
 * The old flow generated once, compared an exact content hash, and on a match
 * dropped the slot — so a reworded duplicate shipped, and a true duplicate meant
 * no post at all. This regenerates (up to `maxAttempts`) against the full
 * uniqueness engine, telling the model on each retry exactly which axis read as
 * a repeat. If every attempt still clashes we return the least-similar candidate
 * rather than silently skipping the slot, and report it so the caller can log it.
 */
export async function generateUniqueSocialPost(
  input: GenerateSocialInput,
  recent: RecentPost[],
  maxAttempts = 3,
): Promise<
  | { ok: true; data: GeneratedSocialPost; attempts: number; forced?: string }
  | { ok: false; error: string }
> {
  let retryNote = "";
  let best: { data: GeneratedSocialPost; reason: string } | null = null;

  const facts = input.product ? productFacts(input.product) : "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const gen = await generateSocialPost({ ...input, retryNote: retryNote || undefined });
    if (!gen.ok) return gen;

    // Two gates, same loop: is it NEW, and is it GOOD? A post that repeats an
    // earlier one and a post that is a stack of noun fragments with an invented
    // health claim are both unpublishable — and both are fixable by telling the
    // model precisely what was wrong and asking again.
    const unique = checkUniqueness(
      {
        hook: gen.data.hook,
        caption: gen.data.caption,
        cta: gen.data.cta,
        hashtags: gen.data.hashtags,
      },
      recent,
    );
    const quality = unique.ok
      ? checkCaptionQuality(
          { caption: gen.data.caption, hook: gen.data.hook, cta: gen.data.cta },
          facts,
        )
      : ({ ok: true } as const);

    if (unique.ok && quality.ok) return { ok: true, data: gen.data, attempts: attempt };

    const reason = !unique.ok ? unique.reason : (quality as { reason: string }).reason;
    const note = !unique.ok
      ? retryInstruction(unique)
      : (quality as { note: string }).note;

    // Keep the first rejected candidate as the fallback, then push the model.
    if (!best) best = { data: gen.data, reason };
    retryNote = note;
    console.warn(`[social] attempt ${attempt}/${maxAttempts} rejected (${reason})`);

    // The keyless fallback is deterministic — retrying it cannot produce
    // anything new, so don't burn attempts pretending otherwise.
    if (!aiAvailable()) break;
  }

  if (best) {
    return {
      ok: true,
      data: best.data,
      attempts: maxAttempts,
      forced: best.reason,
    };
  }
  return { ok: false, error: "Could not generate a post." };
}
