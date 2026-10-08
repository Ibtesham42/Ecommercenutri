"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { ProductPrice } from "@/components/storefront/product-price";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { useVariantSelection } from "@/components/storefront/variant-selection";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { formatPrice, discountPercent, effectivePrice } from "@/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/lib/product-card";
import {
  gstWithin,
  resolveGstRate,
  resolveDeliveryCharge,
  PRICING_DEFAULTS,
  type PricingSettings,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  weightLabel: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  sku?: string | null;
  badge?: string | null;
  /** Variant photo set; [0] is the cover (falls back to the product image). */
  images?: string[];
};

type Highlight = { label: string; value: string };

const trustBadges = [
  { icon: BadgeCheck, label: "100% Authentic" },
  { icon: ShieldCheck, label: "Secure payments" },
  { icon: Truck, label: "Fast delivery" },
  { icon: RotateCcw, label: "Easy returns" },
];

const noSubscribe = () => () => {};
const deliveryWindow = () =>
  `${format(addDays(new Date(), 3), "EEE, d MMM")} – ${format(addDays(new Date(), 5), "EEE, d MMM")}`;

/** The estimated delivery window in the shopper's own timezone. Client-only
 *  (null on the server and during hydration): rendering `new Date()` on both
 *  sides mismatched whenever the server's UTC date differed from the
 *  browser's — every night 00:00–05:30 IST (React #418). */
function useDeliveryWindow() {
  return useSyncExternalStore(noSubscribe, deliveryWindow, () => null);
}

const stepBtn =
  "grid h-12 w-11 place-items-center text-foreground/80 transition-colors hover:text-foreground disabled:text-muted-foreground/40 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg";

/**
 * The buy box below the title: price, size, quantity + Add to cart (the
 * primary, solid forest action), Buy now, wishlist, then delivery and trust
 * notes. Also owns the mobile/tablet sticky bar.
 */
export function ProductPurchase({
  productId,
  slug,
  name,
  image,
  variants,
  wishlisted,
  highlights = [],
  gstRate = null,
  deliveryCharge = null,
  settings = PRICING_DEFAULTS,
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  variants: Variant[];
  wishlisted?: boolean;
  highlights?: Highlight[];
  gstRate?: number | null;
  deliveryCharge?: number | null;
  settings?: PricingSettings;
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const sizeLabelId = useId();
  const delivery = useDeliveryWindow();

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  // Selection lives in the shared PDP context when present (so the gallery,
  // description and nutrition islands switch with it); local state otherwise.
  const selection = useVariantSelection();
  const [localVariantId, setLocalVariantId] = useState(firstAvailable?.id);
  const variantId = selection?.variantId ?? localVariantId;
  const setVariantId = (id: string) =>
    selection ? selection.setVariantId(id) : setLocalVariantId(id);
  const [qty, setQty] = useState(1);

  // The sticky bar appears once the inline actions have scrolled up out of
  // view (below lg) — not before the shopper has reached them. A scroll
  // listener, not an IntersectionObserver: a fling or a #reviews jump can skip
  // straight past the actions without ever "intersecting", so IO never fires.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = actionsRef.current;
      if (el) setShowSticky(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const price = variant ? effectivePrice(variant.price, variant.discountPrice) : 0;
  const off = variant ? discountPercent(variant.price, variant.discountPrice) : null;
  const savings = variant && off ? variant.price - price : 0;
  const outOfStock = !variant || variant.stock <= 0;
  const maxQty = Math.min(variant?.stock ?? 1, 10);
  const lineTotal = price * qty;
  const effectiveGstRate = resolveGstRate(gstRate, settings);
  const gstAmount = gstWithin(lineTotal, effectiveGstRate);
  const effectiveDelivery = resolveDeliveryCharge(deliveryCharge, settings);
  const freeShipping =
    settings.freeShippingEnabled &&
    settings.freeShippingThreshold > 0 &&
    lineTotal >= settings.freeShippingThreshold;
  const lowStock = variant && variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD ? variant.stock : null;

  function add() {
    if (!variant) return;
    addItem(
      {
        variantId: variant.id,
        productId,
        slug,
        name,
        // The variant's own cover when it has one — the cart line then shows
        // exactly what the shopper picked.
        image: variant.images?.[0] ?? image,
        weightLabel: variant.weightLabel,
        price,
        maxStock: variant.stock,
        gstRate,
        deliveryCharge,
      },
      qty,
    );
    trackClient({ type: "CART_ADD", productId });
    toast.success(`Added ${qty} × ${name} (${variant.weightLabel}) to cart`);
  }

  function buyNow() {
    add();
    router.push("/cart");
  }

  // Solid forest primary. Explicit text colour: AddToCartButton's "added"
  // state would otherwise tint the label primary — invisible on a primary fill.
  const addClass =
    "h-12 gap-2 rounded-lg border-transparent text-[15px] font-medium text-primary-foreground";
  const buyClass =
    "h-12 rounded-lg border-foreground/70 bg-transparent text-[15px] font-medium text-foreground hover:bg-foreground hover:text-background";

  return (
    <div>
      {/* Price */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ProductPrice size="xl" price={price} mrp={variant?.price} off={off} />
          {variant?.badge && (
            <span
              key={variant.id}
              className="rounded-md bg-oat px-2 py-1 text-xs font-medium text-oat-foreground motion-safe:animate-fade-in"
            >
              {variant.badge}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {effectiveGstRate > 0
            ? `Incl. ${effectiveGstRate}% GST (${formatPrice(gstAmount)})`
            : "Inclusive of all taxes"}
          {savings > 0 && (
            <>
              {" · "}
              <span className="text-foreground">You save {formatPrice(savings * qty)}</span>
            </>
          )}
        </p>
      </div>

      {/* Size */}
      <div className="mt-6" role="group" aria-labelledby={sizeLabelId}>
        <p id={sizeLabelId} className="text-sm font-medium">
          Size <span className="font-normal text-muted-foreground">· {variant?.weightLabel}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
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
                  "flex min-h-12 min-w-[6.5rem] flex-col items-start justify-center rounded-lg border px-4 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-background ring-1 ring-primary"
                    : "border-border hover:border-foreground/40",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="text-sm font-medium">{v.weightLabel}</span>
                <span className={cn("text-xs tabular-nums text-muted-foreground", disabled && "line-through")}>
                  {disabled ? "Sold out" : formatPrice(vPrice)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity + actions */}
      <div ref={actionsRef} className="mt-6 space-y-2.5">
        <div className="flex gap-2.5">
          <div role="group" aria-label="Quantity" className="flex shrink-0 items-center rounded-lg border border-border">
            <button
              type="button"
              className={stepBtn}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1 || outOfStock}
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-[15px] font-medium tabular-nums" aria-live="polite">
              <span className="sr-only">Quantity </span>
              {qty}
            </span>
            <button
              type="button"
              className={stepBtn}
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty || outOfStock}
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <AddToCartButton
            onAdd={add}
            disabled={outOfStock}
            label={outOfStock ? "Out of stock" : "Add to cart"}
            variant="default"
            iconClassName="size-4 max-[359px]:hidden"
            className={cn(addClass, "flex-1")}
          />
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className={cn(buyClass, "flex-1")} onClick={buyNow} disabled={outOfStock}>
            Buy now
          </Button>
          <WishlistButton
            productId={productId}
            initial={wishlisted}
            className="size-12 shrink-0 rounded-lg border border-border hover:bg-oat"
          />
        </div>
        {lowStock && <p className="text-sm text-muted-foreground">Only {lowStock} left</p>}
      </div>

      {/* Delivery */}
      <ul className="mt-7 space-y-3 border-t border-border pt-5 text-sm">
        <li className="flex items-start gap-3">
          <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground/70" strokeWidth={1.75} />
          <p>
            <span className="font-medium">{delivery ? `Get it ${delivery}` : "Delivery in 3–5 business days"}</span>
            <span className="block text-xs text-muted-foreground">
              Usually delivered in 3–5 business days across India.
            </span>
          </p>
        </li>
        <li className="flex items-start gap-3">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground/70" strokeWidth={1.75} />
          <p>
            {freeShipping || effectiveDelivery === 0 ? (
              <>
                <span className="font-medium text-primary">
                  {effectiveDelivery === 0 && !freeShipping
                    ? "Free Delivery on this product."
                    : "Free Delivery on this order."}
                </span>
                {freeShipping && effectiveDelivery > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    You save {formatPrice(effectiveDelivery)} on shipping.
                  </span>
                )}
              </>
            ) : settings.freeShippingEnabled && settings.freeShippingThreshold > 0 ? (
              <>
                <span className="font-medium">
                  Delivery {formatPrice(effectiveDelivery)} · free over{" "}
                  {formatPrice(settings.freeShippingThreshold)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Add {formatPrice(settings.freeShippingThreshold - lineTotal)} more to
                  qualify for Free Delivery.
                </span>
              </>
            ) : (
              <span className="font-medium">Delivery {formatPrice(effectiveDelivery)}</span>
            )}
          </p>
        </li>
      </ul>

      {/* Nutrition highlights — read as a spec line, not badges. */}
      {highlights.length > 0 && (
        <dl className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border py-3">
          {highlights.map((h) => (
            <div key={h.label} className="min-w-0 px-3 first:pl-0">
              <dt className="truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{h.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium">{h.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {trustBadges.map((b) => (
          <li key={b.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <b.icon className="size-4 shrink-0 text-foreground/60" strokeWidth={1.6} aria-hidden />
            {b.label}
          </li>
        ))}
      </ul>

      {variant?.sku && <p className="mt-4 text-xs text-muted-foreground/80">SKU {variant.sku}</p>}

      {/* Sticky add-to-cart bar (below lg), once the inline actions are passed. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 transition-transform duration-300 motion-reduce:transition-none lg:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-hidden={!showSticky}
        inert={!showSticky}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tabular-nums">{formatPrice(price)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {name} · {variant?.weightLabel}
            </p>
          </div>
          <AddToCartButton
            onAdd={add}
            disabled={outOfStock}
            label={outOfStock ? "Sold out" : "Add"}
            variant="default"
            iconClassName="size-4"
            className="h-11 gap-1.5 rounded-lg border-transparent px-4 text-sm font-medium text-primary-foreground"
          />
          <Button
            variant="outline"
            className="h-11 rounded-lg border-foreground/70 bg-transparent px-4 text-sm font-medium hover:bg-foreground hover:text-background"
            onClick={buyNow}
            disabled={outOfStock}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
