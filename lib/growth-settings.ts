import { prisma } from "@/lib/prisma";

/**
 * Conversion-optimization ("Growth") configuration — admin-editable feature
 * flags + copy for the Health Score quiz, welcome popup, sticky offer bar and
 * trust section, plus the shared welcome coupon. Stored in the additive
 * `StoreSetting.growth` JSON blob (same zero-migration pattern as `pwa`/`seo`).
 * `resolveGrowth` folds the blob over defaults so callers always get a complete,
 * typed config. Everything degrades to sensible on/defaults so the storefront
 * works before an admin touches it.
 */

export type GrowthBlob = {
  quizEnabled?: boolean;
  welcomePopupEnabled?: boolean;
  stickyBarEnabled?: boolean;
  trustEnabled?: boolean;
  couponCode?: string;
  couponPercent?: number;
  popupTitle?: string;
  popupSubtitle?: string;
  stickyText?: string;
};

export type GrowthSettings = Required<GrowthBlob>;

export const GROWTH_DEFAULTS: GrowthSettings = {
  quizEnabled: true,
  welcomePopupEnabled: true,
  stickyBarEnabled: true,
  trustEnabled: true,
  couponCode: "WELCOME20",
  couponPercent: 20,
  popupTitle: "Welcome to Nutriyet",
  popupSubtitle: "Unlock your welcome perks — join thousands eating better.",
  stickyText: "Get 20% OFF your first order • Take your FREE AI Health Assessment",
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Clamp a coupon percent to a sane 1–90 range (defaults on garbage). */
function clampPercent(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 90) return GROWTH_DEFAULTS.couponPercent;
  return n;
}

/** Normalize a coupon code to A-Z0-9 (uppercase); default on empty/invalid. */
function normalizeCode(v: unknown): string {
  const code = s(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 3 && code.length <= 24 ? code : GROWTH_DEFAULTS.couponCode;
}

/** Pure fold of a stored blob over defaults. */
export function resolveGrowth(blob: unknown): GrowthSettings {
  const b = (blob && typeof blob === "object" ? blob : {}) as GrowthBlob;
  return {
    quizEnabled: b.quizEnabled !== false,
    welcomePopupEnabled: b.welcomePopupEnabled !== false,
    stickyBarEnabled: b.stickyBarEnabled !== false,
    trustEnabled: b.trustEnabled !== false,
    couponCode: normalizeCode(b.couponCode),
    couponPercent: clampPercent(b.couponPercent),
    popupTitle: s(b.popupTitle) || GROWTH_DEFAULTS.popupTitle,
    popupSubtitle: s(b.popupSubtitle) || GROWTH_DEFAULTS.popupSubtitle,
    stickyText: s(b.stickyText) || GROWTH_DEFAULTS.stickyText,
  };
}

/** Resolved growth config for the storefront/admin. Defaults on DB error. */
export async function getGrowthSettings(): Promise<GrowthSettings> {
  try {
    const row = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { growth: true },
    });
    return resolveGrowth(row?.growth);
  } catch {
    return GROWTH_DEFAULTS;
  }
}
