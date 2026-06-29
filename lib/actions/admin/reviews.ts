"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

/** Recompute a product's rating aggregate from its approved reviews. */
async function recomputeRatings(productIds: string[]): Promise<void> {
  for (const productId of [...new Set(productIds)]) {
    const agg = await prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }
}

function revalidate(slugs: string[]): void {
  revalidatePath("/admin/reviews");
  for (const slug of new Set(slugs)) revalidatePath(`/products/${slug}`);
}

/** Approve (show) or hide a single review. Hidden reviews drop out of the storefront
 *  and the product rating. */
export async function setReviewApproved(id: string, approved: boolean): Promise<AdminResult> {
  await requirePermission("products");
  const review = await prisma.review.update({
    where: { id },
    data: { isApproved: approved },
    select: { product: { select: { id: true, slug: true } } },
  });
  await recomputeRatings([review.product.id]);
  revalidate([review.product.slug]);
  return { ok: true };
}

/** Permanently delete a single review. */
export async function deleteReview(id: string): Promise<AdminResult> {
  await requirePermission("products");
  const review = await prisma.review.findUnique({
    where: { id },
    select: { product: { select: { id: true, slug: true } } },
  });
  if (!review) return { ok: false, error: "Review not found." };
  await prisma.review.delete({ where: { id } });
  await recomputeRatings([review.product.id]);
  revalidate([review.product.slug]);
  return { ok: true };
}

const REVIEW_BULK_ACTIONS = ["approve", "hide", "delete"] as const;
type ReviewBulkAction = (typeof REVIEW_BULK_ACTIONS)[number];

/** Bulk moderate reviews: approve (show) / hide / delete. Recomputes the affected
 *  products' rating aggregates so the storefront stays in sync. */
export async function bulkReviewAction(
  ids: string[],
  action: ReviewBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("products");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!REVIEW_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    const reviews = await prisma.review.findMany({
      where: { id: { in: ids } },
      select: { id: true, product: { select: { id: true, slug: true } } },
    });
    const productIds = reviews.map((r) => r.product.id);
    const slugs = reviews.map((r) => r.product.slug);

    let done = 0;
    if (action === "delete") {
      done = (await prisma.review.deleteMany({ where: { id: { in: ids } } })).count;
    } else {
      done = (
        await prisma.review.updateMany({
          where: { id: { in: ids } },
          data: { isApproved: action === "approve" },
        })
      ).count;
    }

    await recomputeRatings(productIds);
    revalidate(slugs);
    return { ok: true, data: { done, skipped: ids.length - done } };
  } catch (err) {
    console.error("[admin] bulkReviewAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
