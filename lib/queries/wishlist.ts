import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { productCardSelect, type ProductCardData } from "@/lib/queries/products";

/** Set of product IDs the current user has wishlisted (empty if logged out). */
export async function getWishlistProductIds(): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  return new Set(items.map((i) => i.productId));
}

/** Full product cards for the current user's wishlist. */
export async function getWishlistProducts(): Promise<ProductCardData[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { product: { select: productCardSelect } },
  });
  return items.map((i) => i.product);
}
