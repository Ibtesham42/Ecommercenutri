import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { REF_AT_COOKIE, REF_COOKIE, normalizeRefCode, withinRefWindow } from "@/lib/affiliate/ref-cookie";

/** Read the referral code + click time from the request cookies (server contexts only). */
async function readRefCookies(): Promise<{ code: string | null; at: string | null }> {
  try {
    const c = await cookies();
    return { code: normalizeRefCode(c.get(REF_COOKIE)?.value), at: c.get(REF_AT_COOKIE)?.value ?? null };
  } catch {
    return { code: null, at: null };
  }
}

export type Attribution = { affiliateId: string; referralCode: string };

/**
 * Resolve which affiliate (if any) gets credit for an order. The coupon-owning
 * affiliate wins (precedence); otherwise the last-click referral cookie, if the
 * click is inside the admin's attribution window (`affiliateCookieDays`). Only
 * APPROVED affiliates qualify. Self-referrals (the affiliate buying through their
 * own link/coupon) are never credited.
 */
export async function resolveAttribution(opts: {
  buyerUserId: string;
  couponId?: string | null;
}): Promise<Attribution | null> {
  const settings = await getAffiliateSettings();
  if (!settings.affiliateEnabled) return null;

  // 1) Coupon-owned affiliate.
  if (opts.couponId) {
    const aff = await prisma.affiliate.findFirst({
      where: { couponId: opts.couponId, status: "APPROVED" },
      select: { id: true, code: true, userId: true },
    });
    if (aff) {
      if (aff.userId === opts.buyerUserId) return null; // self-referral
      return { affiliateId: aff.id, referralCode: aff.code };
    }
  }

  // 2) Last-click referral cookie.
  const { code, at } = await readRefCookies();
  if (code && withinRefWindow(at, settings.affiliateCookieDays)) {
    const aff = await prisma.affiliate.findFirst({
      where: { code, status: "APPROVED" },
      select: { id: true, code: true, userId: true },
    });
    if (aff && aff.userId !== opts.buyerUserId) {
      return { affiliateId: aff.id, referralCode: aff.code };
    }
  }

  return null;
}
