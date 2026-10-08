"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/storefront/blur-image";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { discountPercent, effectivePrice } from "@/lib/format";
import { ProductPrice } from "@/components/storefront/product-price";
import { cn } from "@/lib/utils";
import type { QuickViewProductData } from "@/lib/queries/products";

/** A few images, price, variant picker and Add to Cart — everything else
 *  (reviews, description, nutrition) stays on the real PDP, one tap away. */
export function QuickViewDialog({
  productId,
  wishlisted,
  open,
  onOpenChange,
}: {
  productId: string;
  wishlisted?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [product, setProduct] = useState<QuickViewProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/products/${productId}/quick-view`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { product: QuickViewProductData | null }) => {
        if (cancelled) return;
        if (!data.product) {
          setError(true);
          return;
        }
        setProduct(data.product);
        const def =
          data.product.variants.find((v) => v.isDefault && v.stock > 0) ??
          data.product.variants.find((v) => v.stock > 0) ??
          data.product.variants[0];
        setVariantId(def?.id ?? null);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const variant = product?.variants.find((v) => v.id === variantId);
  const outOfStock = !product || product.variants.every((v) => v.stock <= 0);

  function addToCart() {
    if (!product || !variant) return;
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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-2xl` (not a bare `max-w-2xl`) — same 320px fix as the popups:
          preserves the base DialogContent's `max-w-[calc(100%-2rem)]` sizing
          below `sm` instead of overflowing a narrow phone viewport. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
        {loading ? (
          <div className="grid min-h-[320px] place-items-center p-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !product ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Couldn&apos;t load this product. Please try again.
          </div>
        ) : (
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="pcard relative aspect-square bg-(--pcard-media) sm:aspect-auto">
              {product.images[0] ? (
                <BlurImage
                  src={product.images[0].url}
                  alt={product.images[0].alt ?? product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <DialogHeader className="items-start gap-1 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {product.category.name}
                </p>
                <DialogTitle className="text-lg font-semibold leading-snug">
                  {product.name}
                </DialogTitle>
              </DialogHeader>

              {product.ratingCount > 0 && (
                <StarRating rating={product.ratingAvg} count={product.ratingCount} />
              )}

              {variant && (
                <ProductPrice
                  size="lg"
                  price={effectivePrice(variant.price, variant.discountPrice)}
                  mrp={variant.price}
                  off={discountPercent(variant.price, variant.discountPrice)}
                />
              )}

              {product.variants.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.stock <= 0}
                      onClick={() => setVariantId(v.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        v.id === variantId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground/80 hover:border-primary/40",
                      )}
                    >
                      {v.weightLabel}
                    </button>
                  ))}
                </div>
              )}

              {variant && variant.stock > 0 && variant.stock <= 5 && (
                <p className="text-xs text-muted-foreground">Only {variant.stock} left</p>
              )}

              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={addToCart}
                  disabled={outOfStock || !variant}
                  className="h-11 flex-1 gap-2 rounded-lg"
                >
                  <ShoppingBag className="size-4" />
                  {outOfStock ? "Sold out" : "Add to cart"}
                </Button>
                <WishlistButton
                  productId={product.id}
                  initial={wishlisted}
                  className="size-11 border bg-background"
                />
              </div>

              <Link
                href={`/products/${product.slug}`}
                className="mt-1 text-sm font-semibold text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                View full details →
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
