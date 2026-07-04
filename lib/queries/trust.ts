import "server-only";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";

/**
 * Real, database-backed trust stats for the storefront trust section. Each stat
 * is returned ONLY when it clears a small credibility threshold, so we never
 * surface an unimpressive or misleading number (and never a fabricated one). A
 * stat below its threshold comes back as null and the UI simply omits it.
 */

export type TrustStats = {
  ordersDelivered: number | null;
  reviewCount: number | null;
  avgRating: number | null; // 1 decimal, only when reviewCount qualifies
  returningCustomers: number | null;
};

const MIN_ORDERS = 10;
const MIN_REVIEWS = 5;
const MIN_RETURNING = 3;

export async function getTrustStats(): Promise<TrustStats> {
  try {
    return await cached("trust:v1", 300, async () => {
      const [delivered, reviewAgg, returning] = await Promise.all([
        prisma.order.count({ where: { status: "DELIVERED" } }),
        prisma.review.aggregate({
          where: { isApproved: true },
          _count: { _all: true },
          _avg: { rating: true },
        }),
        // Customers with more than one non-cancelled order.
        prisma.order
          .groupBy({
            by: ["userId"],
            where: { status: { not: "CANCELLED" } },
            _count: { _all: true },
            having: { userId: { _count: { gt: 1 } } },
          })
          .then((rows) => rows.length),
      ]);

      const reviewCount = reviewAgg._count._all;
      return {
        ordersDelivered: delivered >= MIN_ORDERS ? delivered : null,
        reviewCount: reviewCount >= MIN_REVIEWS ? reviewCount : null,
        avgRating:
          reviewCount >= MIN_REVIEWS && reviewAgg._avg.rating
            ? Math.round(reviewAgg._avg.rating * 10) / 10
            : null,
        returningCustomers: returning >= MIN_RETURNING ? returning : null,
      };
    });
  } catch (err) {
    console.error("[trust] getTrustStats failed:", err);
    return { ordersDelivered: null, reviewCount: null, avgRating: null, returningCustomers: null };
  }
}
