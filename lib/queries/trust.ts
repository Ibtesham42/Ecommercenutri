import "server-only";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";
import { reviewerName } from "@/lib/reviewer-name";

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

export type HomeReview = {
  id: string;
  rating: number;
  text: string;
  author: string;
  verifiedPurchase: boolean;
  product: { name: string; slug: string };
};

/** Fewer genuine quotes than this and the homepage hides the section. */
export const MIN_HOME_REVIEWS = 3;

/**
 * Homepage testimonials: approved 4★+ customer reviews with a written comment,
 * newest first. Real records only. The section renders nothing when fewer
 * than MIN_HOME_REVIEWS qualify (no placeholder or invented quotes).
 */
export async function getHomeReviews(limit = 6): Promise<HomeReview[]> {
  try {
    const rows = await prisma.review.findMany({
      where: { isApproved: true, rating: { gte: 4 }, comment: { not: null }, product: { isActive: true } },
      orderBy: [{ verifiedPurchase: "desc" }, { createdAt: "desc" }],
      take: limit * 3,
      select: {
        id: true,
        rating: true,
        comment: true,
        verifiedPurchase: true,
        user: { select: { name: true } },
        product: { select: { name: true, slug: true } },
      },
    });
    return rows
      .filter((r) => (r.comment?.trim().length ?? 0) >= 20)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.comment!.trim(),
        author: reviewerName(r.user.name),
        verifiedPurchase: r.verifiedPurchase,
        product: r.product,
      }));
  } catch (err) {
    console.error("[home] reviews failed", err);
    return [];
  }
}
