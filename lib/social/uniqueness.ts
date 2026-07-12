/**
 * Content uniqueness engine for AI Marketing posts.
 *
 * The old guard was a single exact-hash equality check, which let a post through
 * whenever one word changed, and — when it did fire — dropped the slot entirely
 * instead of trying again. This module scores a candidate against recent posts
 * across every axis a reader actually perceives as "the same post again": the
 * hook, the opening and closing lines, the body, the CTA and the hashtag set.
 *
 * Pure and dependency-free (no DB, no AI) so it is cheap to unit-test and safe
 * to import anywhere. The planner and the admin generate/regenerate actions both
 * run candidates through `checkUniqueness` and regenerate on a reject.
 */

export type RecentPost = {
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
};

export type UniquenessCandidate = RecentPost;

export type UniquenessVerdict =
  | { ok: true }
  | { ok: false; reason: string; detail: string };

/** Similarity thresholds (0-1). Tuned to reject "same post, reworded" while
 *  allowing genuinely different posts that share brand vocabulary. */
export const THRESHOLDS = {
  hook: 0.6, // hooks are short — near-identical wording is obvious to a reader
  opening: 0.65, // first line of the caption
  closing: 0.7, // last line (the invitation) — some repetition is natural
  caption: 0.55, // whole body
  cta: 0.8, // CTAs are 2-5 words; only near-exact repeats matter
  hashtags: 0.8, // the tag COMBINATION, not individual tags
} as const;

/** How many recent posts a candidate is compared against. */
export const COMPARE_WINDOW = 25;

/** Lowercase, strip punctuation/emoji, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content words only — drop the filler that every caption shares. */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "for",
  "with", "from", "by", "is", "are", "was", "were", "be", "been", "it", "its",
  "this", "that", "these", "those", "you", "your", "we", "our", "us", "i", "me",
  "as", "so", "too", "very", "just", "not", "no", "yes", "do", "does", "did",
  "can", "will", "would", "there", "here", "what", "when", "how", "why", "who",
]);

export function contentTokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Jaccard similarity over content-word sets. 1 = identical, 0 = disjoint. */
export function jaccard(a: string, b: string): number {
  const sa = new Set(contentTokens(a));
  const sb = new Set(contentTokens(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  return shared / (sa.size + sb.size - shared);
}

/** Jaccard over a hashtag COMBINATION (order- and case-insensitive). */
export function tagSimilarity(a: string[], b: string[]): number {
  const sa = new Set(a.map((t) => t.toLowerCase()));
  const sb = new Set(b.map((t) => t.toLowerCase()));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  return shared / (sa.size + sb.size - shared);
}

function firstLine(caption: string): string {
  return caption.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
}

function lastLine(caption: string): string {
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

/**
 * Is this candidate meaningfully different from everything posted recently?
 * Returns the first axis that fails, so the caller can tell the model exactly
 * what to change on the retry.
 */
export function checkUniqueness(
  candidate: UniquenessCandidate,
  recent: RecentPost[],
): UniquenessVerdict {
  for (const prev of recent.slice(0, COMPARE_WINDOW)) {
    const hook = jaccard(candidate.hook, prev.hook);
    if (hook >= THRESHOLDS.hook) {
      return { ok: false, reason: "hook", detail: prev.hook };
    }

    const opening = jaccard(firstLine(candidate.caption), firstLine(prev.caption));
    if (opening >= THRESHOLDS.opening) {
      return { ok: false, reason: "opening line", detail: firstLine(prev.caption) };
    }

    const closing = jaccard(lastLine(candidate.caption), lastLine(prev.caption));
    if (closing >= THRESHOLDS.closing) {
      return { ok: false, reason: "closing line", detail: lastLine(prev.caption) };
    }

    const body = jaccard(candidate.caption, prev.caption);
    if (body >= THRESHOLDS.caption) {
      return { ok: false, reason: "caption", detail: prev.hook || firstLine(prev.caption) };
    }

    if (candidate.cta && prev.cta && jaccard(candidate.cta, prev.cta) >= THRESHOLDS.cta) {
      return { ok: false, reason: "call to action", detail: prev.cta };
    }

    if (tagSimilarity(candidate.hashtags, prev.hashtags) >= THRESHOLDS.hashtags) {
      return {
        ok: false,
        reason: "hashtag combination",
        detail: prev.hashtags.join(" "),
      };
    }
  }
  return { ok: true };
}

/**
 * Which of the candidate's axes clashed — used to build the retry instruction so
 * the second attempt changes the RIGHT thing rather than rerolling blindly.
 */
export function retryInstruction(verdict: UniquenessVerdict): string {
  if (verdict.ok) return "";
  const map: Record<string, string> = {
    hook: `Your hook is too close to a recent post ("${verdict.detail}"). Open on a completely different idea and sentence shape.`,
    "opening line": `Your first line repeats a recent post ("${verdict.detail}"). Start somewhere else entirely.`,
    "closing line": `Your closing line repeats a recent post ("${verdict.detail}"). Invite engagement a different way.`,
    caption: `Your caption covers the same ground as a recent post ("${verdict.detail}"). Take a genuinely different angle.`,
    "call to action": `Your CTA repeats a recent one ("${verdict.detail}"). Write a fresh one.`,
    "hashtag combination": `Your hashtag set is nearly the same as a recent post (${verdict.detail}). Choose a different, still-relevant mix.`,
  };
  return map[verdict.reason] ?? "Write something meaningfully different from the recent posts.";
}
