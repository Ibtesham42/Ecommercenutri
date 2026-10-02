import { prisma } from "@/lib/prisma";

/** Active, public, in-window coupons — the shopper-facing /offers page and the
 *  cart teaser both read from this single query. */
export async function getPublicCoupons() {
  const now = new Date();
  return prisma.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}
