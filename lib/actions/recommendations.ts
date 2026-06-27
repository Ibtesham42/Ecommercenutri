"use server";

import { z } from "zod";
import type { ProductCardData } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { complementaryForCart } from "@/lib/recommendations/service";

const inputSchema = z.object({
  productIds: z.array(z.string().max(40)).max(50),
});

export type CartCrossSellResult = {
  products: ProductCardData[];
  wishlistedIds: string[];
};

/** Complementary cross-sell for the current cart (server-authoritative). */
export async function cartCrossSell(input: unknown): Promise<CartCrossSellResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { products: [], wishlistedIds: [] };

  const [products, wishlisted] = await Promise.all([
    complementaryForCart(parsed.data.productIds, 4),
    getWishlistProductIds(),
  ]);
  return { products, wishlistedIds: [...wishlisted] };
}
