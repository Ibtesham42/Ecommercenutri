"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/recommendations/events";

export type ToggleWishlistResult =
  | { wishlisted: boolean }
  | { error: "UNAUTHENTICATED" };

export async function toggleWishlist(
  productId: string,
): Promise<ToggleWishlistResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "UNAUTHENTICATED" };

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { wishlisted: false };
  }

  await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  await trackEvent({ type: "WISHLIST_ADD", userId: user.id, productId });
  revalidatePath("/account/wishlist");
  return { wishlisted: true };
}

export async function removeFromWishlist(productId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
  revalidatePath("/account/wishlist");
}
