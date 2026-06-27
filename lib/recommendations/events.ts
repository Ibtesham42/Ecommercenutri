import type { UserEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** A behavioral signal to record. Privacy-preserving: identity is the session
 *  userId when signed in, else an anonymous cookie id. No PII is stored. */
export type TrackInput = {
  type: UserEventType;
  userId?: string | null;
  anonId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  query?: string | null;
  source?: string | null;
};

/** Record a behavioral event. Best-effort — never throws to the caller. */
export async function trackEvent(input: TrackInput): Promise<void> {
  try {
    await prisma.userEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        anonId: input.anonId ?? null,
        productId: input.productId ?? null,
        categoryId: input.categoryId ?? null,
        query: input.query?.slice(0, 200) ?? null,
        source: input.source?.slice(0, 60) ?? null,
      },
    });
  } catch (err) {
    console.error("[reco] trackEvent failed:", err);
  }
}

export type UserSignals = {
  categoryIds: string[]; // categories the user has shown affinity for
  viewedProductIds: string[]; // recently viewed (newest first)
  purchasedProductIds: string[];
  wishlistProductIds: string[];
};

/**
 * Aggregate a shopper's behavioral signals for personalization. Combines the
 * durable signals (wishlist, purchases) with recent behavior from the event log
 * (product/category views, searches). Works for guests via `anonId`.
 */
export async function getUserSignals(
  userId: string | null | undefined,
  anonId: string | null | undefined,
): Promise<UserSignals> {
  const identity = userId
    ? { userId }
    : anonId
      ? { anonId }
      : null;

  const [events, wishlist, orderItems] = await Promise.all([
    identity
      ? prisma.userEvent.findMany({
          where: {
            ...identity,
            type: { in: ["PRODUCT_VIEW", "CATEGORY_VIEW", "RECO_CLICK"] },
          },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { productId: true, categoryId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.wishlistItem.findMany({
          where: { userId },
          select: { productId: true, product: { select: { categoryId: true } } },
        })
      : Promise.resolve([]),
    userId
      ? prisma.orderItem.findMany({
          where: { order: { userId } },
          select: { productId: true, product: { select: { categoryId: true } } },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const categoryIds = new Set<string>();
  const viewedProductIds: string[] = [];
  const seenViewed = new Set<string>();
  for (const e of events) {
    if (e.categoryId) categoryIds.add(e.categoryId);
    if (e.productId && !seenViewed.has(e.productId)) {
      seenViewed.add(e.productId);
      viewedProductIds.push(e.productId);
    }
  }

  const wishlistProductIds: string[] = [];
  for (const w of wishlist) {
    wishlistProductIds.push(w.productId);
    if (w.product?.categoryId) categoryIds.add(w.product.categoryId);
  }

  const purchasedProductIds: string[] = [];
  for (const o of orderItems) {
    if (o.productId) purchasedProductIds.push(o.productId);
    if (o.product?.categoryId) categoryIds.add(o.product.categoryId);
  }

  return {
    categoryIds: [...categoryIds],
    viewedProductIds,
    purchasedProductIds,
    wishlistProductIds,
  };
}
