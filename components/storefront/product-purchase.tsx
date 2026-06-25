"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { useCart } from "@/lib/store/cart";
import { formatPrice, discountPercent, effectivePrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  weightLabel: string;
  price: number;
  discountPrice: number | null;
  stock: number;
};

export function ProductPurchase({
  productId,
  slug,
  name,
  image,
  variants,
  wishlisted,
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  variants: Variant[];
  wishlisted?: boolean;
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const price = variant ? effectivePrice(variant.price, variant.discountPrice) : 0;
  const off = variant ? discountPercent(variant.price, variant.discountPrice) : null;
  const outOfStock = !variant || variant.stock <= 0;
  const maxQty = Math.min(variant?.stock ?? 1, 10);

  function add() {
    if (!variant) return;
    addItem(
      {
        variantId: variant.id,
        productId,
        slug,
        name,
        image,
        weightLabel: variant.weightLabel,
        price,
        maxStock: variant.stock,
      },
      qty,
    );
    toast.success(`Added ${qty} × ${name} (${variant.weightLabel}) to cart`);
  }

  function buyNow() {
    add();
    router.push("/cart");
  }

  return (
    <div className="space-y-6">
      {/* Price */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold">{formatPrice(price)}</span>
        {variant?.discountPrice &&
          effectivePrice(variant.price, variant.discountPrice) < variant.price && (
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(variant.price)}
            </span>
          )}
        {off ? (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
            {off}% OFF
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">incl. of all taxes</span>
      </div>

      {/* Variant selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Weight:{" "}
          <span className="text-muted-foreground">{variant?.weightLabel}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const isActive = v.id === variant?.id;
            const disabled = v.stock <= 0;
            return (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setVariantId(v.id);
                  setQty(1);
                }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:border-primary/40",
                  disabled && "cursor-not-allowed opacity-40 line-through",
                )}
              >
                {v.weightLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Quantity</span>
        <div className="flex items-center rounded-lg border">
          <button
            type="button"
            className="grid size-9 place-items-center disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || outOfStock}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            className="grid size-9 place-items-center disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty || outOfStock}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {variant && variant.stock > 0 && variant.stock <= 10 && (
          <span className="text-xs text-amber-600">
            Only {variant.stock} left
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          variant="outline"
          className="flex-1 gap-2"
          onClick={add}
          disabled={outOfStock}
        >
          <ShoppingCart className="size-4" />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </Button>
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={buyNow}
          disabled={outOfStock}
        >
          <Zap className="size-4" />
          Buy now
        </Button>
        <WishlistButton productId={productId} initial={wishlisted} withLabel />
      </div>
    </div>
  );
}
