/**
 * Caption quality gate.
 *
 * The uniqueness engine stops a post repeating an earlier one; this stops a post
 * being *bad on its own terms*. Both feed the same regenerate loop.
 *
 * Written against REAL generated output, not theory. Reading five live posts
 * showed two recurring failures the prompt alone did not prevent:
 *
 *  1. Telegraphic filler — "Rich in antioxidants / Supports immunity / Great for
 *     digestion" — a stack of noun fragments that reads like a bullet list a
 *     machine produced, which is precisely the "robotic AI writing" we are
 *     trying to avoid.
 *  2. Invented benefits — health claims that appear nowhere in the product data.
 *     "Supports immunity" is not a banned WORD, so the claim sanitizer let it
 *     through, but we must not assert it unless the catalog says it.
 *
 * Pure and dependency-free, so it is cheap to test.
 */

export type QualityCandidate = {
  caption: string;
  hook: string;
  cta: string;
};

export type QualityVerdict = { ok: true } | { ok: false; reason: string; note: string };

/** Health/benefit assertions we will not make unless the product data says so. */
const CLAIM_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(boosts?|supports?|improves?|strengthens?|builds?)\s+(immunity|immune system)\b/i, label: "an immunity claim" },
  { re: /\b(aids?|improves?|helps?|supports?|good for)\s+digestion\b/i, label: "a digestion claim" },
  { re: /\brich in antioxidants?\b/i, label: "an antioxidant claim" },
  { re: /\b(lowers?|reduces?|controls?)\s+(cholesterol|blood sugar|blood pressure|weight)\b/i, label: "a medical claim" },
  { re: /\bhelps? (you )?(lose|shed) weight\b/i, label: "a weight-loss claim" },
  { re: /\b(anti[- ]?inflammatory|metabolism boost(ing|er)?)\b/i, label: "a physiological claim" },
];

/** Marketing filler that reads as generic no matter the product. */
const FILLER_PATTERNS = [
  /takes? (snacking|it|things) to (a )?(the )?next level/i,
  /created equal/i,
  /look no further/i,
  /a game[- ]changer/i,
  /elevate your/i,
  /wholesome goodness/i,
];

/** Hype adjectives. The prompt forbids them and the model still reaches for
 *  them ("Perfect for satisfying your cravings"), so the gate enforces it. */
const HYPE_PATTERNS = [
  /\bperfect\b/i,
  /\bamazing\b/i,
  /\bultimate\b/i,
  /\bmust[- ]have\b/i,
  /\bgame[- ]?changer\b/i,
  /\brevolutionary\b/i,
  /\bunbeatable\b/i,
  /\bbest[- ]ever\b/i,
  /\bincredible\b/i,
  /\bmind[- ]blowing\b/i,
];

const MIN_CAPTION_CHARS = 140;

/** A line is "telegraphic" when it is a short fragment with no verb — the
 *  bullet-list cadence that makes a caption read like machine output. */
function isFragment(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length > 8) return false; // long enough to be a real sentence
  // Cheap verb sniff: a fragment like "Rich in antioxidants" has none of these.
  const VERBish = /\b(is|are|was|were|be|has|have|had|do|does|did|can|will|would|make|makes|made|take|takes|add|adds|keep|keeps|give|gives|get|gets|goes|go|comes|come|eat|eats|try|tries|feel|feels|know|knows|think|thinks|want|wants|need|needs|love|loves|use|uses|roast|roasted|fried|pack|packs|sit|sits|reach|reaches|swap|swaps|tell|tells|share|shares|save|saves)\b/i;
  const isQuestion = line.trim().endsWith("?");
  return !VERBish.test(line) && !isQuestion;
}

/**
 * Is this caption good enough to publish?
 *
 * `productFacts` is the factual block the model was given. A benefit claim is
 * allowed only when the catalog actually supports it — so the check is
 * "did we make this up", not "is this word forbidden".
 */
export function checkCaptionQuality(
  candidate: QualityCandidate,
  productFacts = "",
): QualityVerdict {
  const caption = candidate.caption.trim();
  const facts = productFacts.toLowerCase();

  if (caption.length < MIN_CAPTION_CHARS) {
    return {
      ok: false,
      reason: "too thin",
      note: `The caption is only ${caption.length} characters and says very little. Write a real post: open on a specific idea, give one piece of genuine value in full sentences, then invite a reply.`,
    };
  }

  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const fragments = lines.filter(isFragment);
  if (lines.length >= 3 && fragments.length / lines.length > 0.5) {
    return {
      ok: false,
      reason: "telegraphic",
      note: `Lines like "${fragments[0]}" are noun fragments stacked like a bullet list — that is exactly how AI copy reads. Write in complete, human sentences that flow.`,
    };
  }

  for (const { re, label } of CLAIM_PATTERNS) {
    const hit = caption.match(re) ?? candidate.hook.match(re);
    if (hit) {
      // Allowed only if the catalog itself states it.
      const phrase = hit[0].toLowerCase();
      const supported =
        facts.includes(phrase) ||
        (phrase.includes("antioxidant") && facts.includes("antioxidant")) ||
        (phrase.includes("digestion") && facts.includes("digest")) ||
        (phrase.includes("immun") && facts.includes("immun"));
      if (!supported) {
        return {
          ok: false,
          reason: "unsupported claim",
          note: `"${hit[0]}" is ${label} that the product data does not state. Never assert a health benefit we cannot back up — talk about the food, the taste, the habit or the moment instead.`,
        };
      }
    }
  }

  for (const re of FILLER_PATTERNS) {
    const hit = caption.match(re);
    if (hit) {
      return {
        ok: false,
        reason: "generic marketing language",
        note: `"${hit[0]}" is stock marketing filler that could describe any brand. Say something only Nutriyet, with this product, could say.`,
      };
    }
  }

  for (const re of HYPE_PATTERNS) {
    const hit = caption.match(re) ?? candidate.hook.match(re);
    if (hit) {
      return {
        ok: false,
        reason: "hype language",
        note: `"${hit[0]}" is a hype adjective — it makes the post sound like an ad and costs us trust. Describe the thing plainly and let the reader decide.`,
      };
    }
  }

  return { ok: true };
}
