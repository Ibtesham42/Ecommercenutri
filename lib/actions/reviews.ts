"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reviewSchema } from "@/lib/validations/review";

export type ReviewState = { error?: string; success?: string } | undefined;

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
  if (!parsed.success) return { error: "Please select a star rating." };

  const { productId, slug, rating, title, comment } = parsed.data;

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
