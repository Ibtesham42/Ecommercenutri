"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { effectivePrice } from "@/lib/format";
import type { CartItem } from "@/lib/store/cart";

export type ReorderItem = CartItem;

export type ReorderResult =
  | { ok: true; items: ReorderItem[]; unavailable: number }
  | { ok: false; error: string };

/**
 * Resolve a past order's line items into cart-ready items priced at CURRENT
 * catalog values (server-authoritative), skipping anything now inactive or
 * out of stock. The client adds the returned items to the (client-side) cart —
 * one-tap "Buy it again", the core repeat-purchase lever for a consumables
 * brand. Quantities are clamped to available stock.
 */
export async function getReorderItems(orderNumber: string): Promise<ReorderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to reorder." };

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: { items: { select: { variantId: true, quantity: true } } },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const variantIds = order.items
    .map((i) => i.variantId)
    .filter((id): id is string => Boolean(id));
  if (variantIds.length === 0) return { ok: false, error: "These items can't be reordered." };

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    select: {
      id: true,
      weightLabel: true,
      price: true,
      discountPrice: true,
      stock: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          gstRate: true,
          deliveryCharge: true,
          images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const items: ReorderItem[] = [];
  let unavailable = 0;
  for (const line of order.items) {
    const v = line.variantId ? byId.get(line.variantId) : undefined;
    if (!v || !v.product.isActive || v.stock <= 0) {
      unavailable += 1;
      continue;
    }
    items.push({
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      image: v.product.images[0]?.url ?? null,
      weightLabel: v.weightLabel,
      price: effectivePrice(v.price, v.discountPrice),
      quantity: Math.max(1, Math.min(line.quantity, v.stock)),
      maxStock: v.stock,
      gstRate: v.product.gstRate,
      deliveryCharge: v.product.deliveryCharge,
    });
  }

  if (items.length === 0) {
    return { ok: false, error: "Those items are currently unavailable." };
  }
  return { ok: true, items, unavailable };
}
