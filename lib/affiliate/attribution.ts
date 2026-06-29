import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAffiliateSettings } from "@/lib/queries/settings";

export const REF_COOKIE = "nut_ref";

/** Read the referral code from the request cookie (server contexts only). */
export async function readRefCookie(): Promise<string | null> {
  try {
    const c = await cookies();
    return c.get(REF_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

export type Attribution = { affiliateId: string; referralCode: string };

/**
 * Resolve which affiliate (if any) gets credit for an order. The coupon-owning
 * affiliate wins (precedence); otherwise the last-click referral cookie. Self-
 * referrals (the affiliate buying through their own link/coupon) are never credited.
 */
export async function resolveAttribution(opts: {
  buyerUserId: string;
  couponId?: string | null;
  refCode?: string | null;
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
  const code = opts.refCode ?? (await readRefCookie());
  if (code) {
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
