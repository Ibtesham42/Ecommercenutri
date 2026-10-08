"use client";

import { toast } from "sonner";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { effectivePrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * One-tap "Add" on a product card. Picks the default (or first in-stock) variant
 * and adds it to the cart, mirroring exactly what `product-purchase.tsx` does —
 * same `useCart().addItem` + `trackClient` + toast. No new server logic; prices
 * are still re-priced authoritatively at checkout (`previewOrderPricing`).
 */
export function QuickAddButton({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  const addItem = useCart((s) => s.addItem);

  const variant =
    product.variants.find((v) => v.isDefault && v.stock > 0) ??
    product.variants.find((v) => v.stock > 0) ??
    product.variants.find((v) => v.isDefault) ??
    product.variants[0];
  const outOfStock = !variant || product.variants.every((v) => v.stock <= 0);

  function add() {
    if (!variant) return;
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
    toast.success(`Added ${product.name} (${variant.weightLabel}) to cart`);
  }

  return (
    <AddToCartButton
      onAdd={add}
      disabled={outOfStock}
      label={outOfStock ? "Sold out" : "Add to cart"}
      addedLabel="Added"
      srContext={product.name}
      variant={outOfStock ? "outline" : "default"}
      size="sm"
      iconClassName="size-4 max-[359px]:hidden"
      className={cn(
        // 44px on touch, 40px where there's a precise pointer. Explicit text
        // colour: AddToCartButton's "added" state would otherwise tint the
        // label primary — invisible on a primary fill.
        "h-11 w-full gap-1.5 rounded-lg text-[13px] font-medium sm:text-sm [@media(hover:hover)_and_(pointer:fine)]:h-10",
        outOfStock
          ? "border-border bg-transparent text-muted-foreground disabled:opacity-100"
          : "border-transparent text-primary-foreground",
        className,
      )}
    />
  );
}
