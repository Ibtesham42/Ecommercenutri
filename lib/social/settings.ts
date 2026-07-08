import { prisma } from "@/lib/prisma";
import type { SocialPublishMode } from "@prisma/client";

/**
 * AI Marketing (social automation) global defaults — brand voice, the default
 * posting schedule, default hashtags and a banned-words/claims list. Stored in
 * the additive `StoreSetting.social` JSON blob (same zero-migration pattern as
 * `growth`/`pwa`/`seo`). `resolveSocial` folds the blob over defaults so callers
 * always get a complete, typed config. A `SocialCampaign` may override the
 * schedule/mode for its own window; these are the fallbacks.
 */

export type SocialBlob = {
  enabled?: boolean;
  brandVoice?: string;
  morningTime?: string; // "HH:mm" IST
  eveningTime?: string; // "HH:mm" IST
  days?: number[]; // 0=Sun..6=Sat
  maxPerDay?: number;
  mode?: SocialPublishMode;
  defaultHashtags?: string[];
  bannedWords?: string[];
  carouselEnabled?: boolean;
};

export type SocialSettings = Required<SocialBlob>;

export const SOCIAL_DEFAULTS: SocialSettings = {
  enabled: true,
  brandVoice:
    "Warm, trustworthy and health-positive. Speaks to Indian families about " +
    "clean, wholesome nutrition (makhana, dry fruits, seeds, healthy snacks). " +
    "Never makes medical or exaggerated health claims.",
  morningTime: "09:00",
  eveningTime: "18:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  maxPerDay: 2,
  mode: "MANUAL_APPROVAL",
  defaultHashtags: ["#Nutriyet", "#HealthySnacking", "#Makhana", "#EatClean"],
  // Words/claims that must never appear in generated copy (health-claim safety).
  bannedWords: [
    "cure",
    "cures",
    "treats",
    "treatment",
    "prevents disease",
    "medically proven",
    "clinically proven",
    "miracle",
    "guaranteed weight loss",
    "detox",
  ],
  carouselEnabled: true,
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "HH:mm" 24h validator; default on garbage. */
function normalizeTime(v: unknown, fallback: string): string {
  const t = s(v);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : fallback;
}

function normalizeDays(v: unknown): number[] {
  if (!Array.isArray(v)) return SOCIAL_DEFAULTS.days;
  const days = [...new Set(v.map((d) => Math.trunc(Number(d))).filter((d) => d >= 0 && d <= 6))];
  return days.length ? days.sort((a, b) => a - b) : SOCIAL_DEFAULTS.days;
}

function normalizeMode(v: unknown): SocialPublishMode {
  return v === "AUTO_PUBLISH" || v === "MANUAL_APPROVAL" || v === "DRAFT"
    ? v
    : SOCIAL_DEFAULTS.mode;
}

function normalizeStrings(v: unknown, fallback: string[], cap = 40): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = [...new Set(v.map((x) => s(x)).filter(Boolean))].slice(0, cap);
  return out;
}

function clampMax(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 10) return SOCIAL_DEFAULTS.maxPerDay;
  return n;
}

/** Pure fold of a stored blob over defaults. */
export function resolveSocial(blob: unknown): SocialSettings {
  const b = (blob && typeof blob === "object" ? blob : {}) as SocialBlob;
  return {
    enabled: b.enabled !== false,
    brandVoice: s(b.brandVoice) || SOCIAL_DEFAULTS.brandVoice,
    morningTime: normalizeTime(b.morningTime, SOCIAL_DEFAULTS.morningTime),
    eveningTime: normalizeTime(b.eveningTime, SOCIAL_DEFAULTS.eveningTime),
    days: normalizeDays(b.days),
    maxPerDay: clampMax(b.maxPerDay),
    mode: normalizeMode(b.mode),
    defaultHashtags: normalizeStrings(b.defaultHashtags, SOCIAL_DEFAULTS.defaultHashtags),
    bannedWords: normalizeStrings(b.bannedWords, SOCIAL_DEFAULTS.bannedWords),
    carouselEnabled: b.carouselEnabled !== false,
  };
}

/** Resolved social config. Defaults on DB error (never throws). */
export async function getSocialSettings(): Promise<SocialSettings> {
  try {
    const row = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { social: true },
    });
    return resolveSocial(row?.social);
  } catch {
    return SOCIAL_DEFAULTS;
  }
}
