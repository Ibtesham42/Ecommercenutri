"use client";

import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { effectivePrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries/products";

/** Adds every in-stock wishlist item to the cart in one tap — same default-variant
 *  resolution and cart-add call as `QuickAddButton`, just looped. */
export function WishlistBulkAdd({ products }: { products: ProductCardData[] }) {
  const addItem = useCart((s) => s.addItem);

  function addAll() {
    let added = 0;
    let skipped = 0;
    for (const product of products) {
      const variant =
        product.variants.find((v) => v.isDefault && v.stock > 0) ??
        product.variants.find((v) => v.stock > 0) ??
        null;
      if (!variant) {
        skipped++;
        continue;
      }
      addItem(
        {
          variantId: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.images[0]?.url ?? null,
          weightLabel: variant.weightLabel,
          price: effectivePrice(variant.price, variant.discountPrice),
          maxStock: variant.stock,
        },
        1,
      );
      trackClient({ type: "CART_ADD", productId: product.id });
      added++;
    }
    if (added === 0) {
      toast.error("Everything in your wishlist is currently out of stock.");
      return;
    }
    toast.success(
      skipped > 0
        ? `Added ${added} item${added === 1 ? "" : "s"} to cart — ${skipped} out of stock.`
        : `Added ${added} item${added === 1 ? "" : "s"} to cart.`,
    );
  }

  return (
    <Button onClick={addAll} className="gap-2" size="sm">
      <ShoppingCart className="size-4" />
      Add all to cart
    </Button>
  );
}
