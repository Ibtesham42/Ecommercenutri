"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  ShieldCheck,
  Truck,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { useCart } from "@/lib/store/cart";
import { formatPrice, discountPercent, effectivePrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  weightLabel: string;
  price: number;
  discountPrice: number | null;
  stock: number;
};

type Highlight = { label: string; value: string };

const trustBadges = [
  { icon: BadgeCheck, label: "100% Authentic" },
  { icon: ShieldCheck, label: "Secure payments" },
  { icon: Truck, label: "Fast delivery" },
  { icon: RotateCcw, label: "Easy returns" },
];

export function ProductPurchase({
  productId,
  slug,
  name,
  image,
  variants,
  wishlisted,
  highlights = [],
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  variants: Variant[];
  wishlisted?: boolean;
  highlights?: Highlight[];
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);

  // Show a sticky bar once the inline actions scroll out of view (mobile only).
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const price = variant ? effectivePrice(variant.price, variant.discountPrice) : 0;
  const off = variant ? discountPercent(variant.price, variant.discountPrice) : null;
  const savings = variant && off ? variant.price - price : 0;
  const outOfStock = !variant || variant.stock <= 0;
  const maxQty = Math.min(variant?.stock ?? 1, 10);
  const freeShipping = price * qty >= FREE_SHIPPING_THRESHOLD;

  const deliveryFrom = format(addDays(new Date(), 3), "EEE, d MMM");
  const deliveryTo = format(addDays(new Date(), 5), "EEE, d MMM");

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
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold tracking-tight sm:text-4xl">
            {formatPrice(price)}
          </span>
          {savings > 0 && (
            <>
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(variant!.price)}
              </span>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                {off}% OFF
              </Badge>
            </>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          {savings > 0 && (
            <span className="font-medium text-primary">
              You save {formatPrice(savings * qty)}
            </span>
          )}
          <span className="text-muted-foreground">inclusive of all taxes</span>
        </div>
      </div>

      {/* Highlights (nutrition-derived chips) */}
      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {highlights.map((h) => (
            <span
              key={h.label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-accent/40 px-3 py-1.5 text-xs font-medium"
            >
              <span className="text-muted-foreground">{h.label}</span>
              <span className="font-semibold">{h.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Variant selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Select weight</p>
          <span className="text-sm text-muted-foreground">{variant?.weightLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {variants.map((v) => {
            const isActive = v.id === variant?.id;
            const disabled = v.stock <= 0;
            const vPrice = effectivePrice(v.price, v.discountPrice);
            return (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setVariantId(v.id);
                  setQty(1);
                }}
                aria-pressed={isActive}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/40",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="text-sm font-semibold">{v.weightLabel}</span>
                <span
                  className={cn(
                    "text-xs",
                    disabled ? "line-through" : "text-muted-foreground",
                  )}
                >
                  {disabled ? "Sold out" : formatPrice(vPrice)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold">Quantity</span>
        <div className="flex items-center rounded-xl border">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-l-xl transition hover:bg-accent disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || outOfStock}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-base font-semibold tabular-nums">
            {qty}
          </span>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-r-xl transition hover:bg-accent disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty || outOfStock}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {variant && variant.stock > 0 && variant.stock <= 10 && (
          <span className="text-xs font-medium text-amber-600">
            Only {variant.stock} left
          </span>
        )}
      </div>

      {/* Inline actions */}
      <div ref={actionsRef} className="space-y-3">
        <div className="flex gap-3">
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-1 gap-2 text-base"
            onClick={add}
            disabled={outOfStock}
          >
            <ShoppingCart className="size-5" />
            {outOfStock ? "Out of stock" : "Add to cart"}
          </Button>
          <WishlistButton
            productId={productId}
            initial={wishlisted}
            className="size-12 shrink-0 rounded-xl border hover:bg-accent"
          />
        </div>
        <Button
          size="lg"
          className="h-12 w-full gap-2 text-base"
          onClick={buyNow}
          disabled={outOfStock}
        >
          <Zap className="size-5" />
          Buy now
        </Button>
      </div>

      {/* Delivery & shipping */}
      <div className="space-y-2.5 rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Get it {deliveryFrom} – {deliveryTo}</span>
            <span className="block text-xs text-muted-foreground">
              Usually delivered in 3–5 business days across India.
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            {freeShipping ? (
              <span className="font-medium text-primary">
                This order ships free.
              </span>
            ) : (
              <>
                <span className="font-medium">
                  Free shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Add {formatPrice(FREE_SHIPPING_THRESHOLD - price * qty)} more to qualify.
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4">
        {trustBadges.map((b) => (
          <div key={b.label} className="flex flex-col items-center gap-1.5 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <b.icon className="size-5" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
          </div>
        ))}
      </div>

      {/* Sticky mobile add-to-cart bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur transition-transform duration-300 lg:hidden",
          showSticky ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{formatPrice(price)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {name} · {variant?.weightLabel}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 gap-1.5"
            onClick={add}
            disabled={outOfStock}
          >
            <ShoppingCart className="size-4" />
            Add
          </Button>
          <Button className="h-11 gap-1.5" onClick={buyNow} disabled={outOfStock}>
            <Zap className="size-4" />
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
