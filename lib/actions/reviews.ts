"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { reviewSchema } from "@/lib/validations/review";

export type ReviewState = { error?: string; success?: string } | undefined;

/** Turn a Zod failure into the field-level message the reviewer can act on. */
function reviewError(field: string | undefined): string {
  switch (field) {
    case "rating":
      return "Please select a star rating from 1 to 5.";
    case "title":
      return "Please shorten your headline to 120 characters or less.";
    case "comment":
      return "Please shorten your review to 2000 characters or less.";
    default:
      return "We couldn't read that review — please reload the page and try again.";
  }
}

export async function submitReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to write a review." };

  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    slug: formData.get("slug"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) {
    return { error: reviewError(parsed.error.issues[0]?.path[0]?.toString()) };
  }

  const { productId, slug, rating, title, comment } = parsed.data;

  // Reviews publish immediately, so throttle the write path.
  const rl = await checkRateLimit(limiters.api, `review:${user.id}`);
  if (!rl.success) {
    return { error: "You're submitting reviews too quickly — please wait a minute and try again." };
  }

  // A review for a product that doesn't exist would 500 on the FK; fail kindly.
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { error: "That product is no longer available." };

  await prisma.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, title, comment, isApproved: true },
    create: { productId, userId: user.id, rating, title, comment, isApproved: true },
  });

  // Recompute the product's rating aggregate from approved reviews.
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });

  revalidatePath(`/products/${slug}`);
  return { success: "Thanks for your review!" };
}
