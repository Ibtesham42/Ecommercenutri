"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2, ShieldCheck, ArrowLeft, ArrowRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartEmpty } from "@/components/storefront/cart/cart-empty";
import { OrderTotals } from "@/components/storefront/cart/order-totals";
import { StickyTotalBar } from "@/components/storefront/cart/sticky-total-bar";
import { useViewportPosition } from "@/components/storefront/use-viewport-position";
import { useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/use-hydrated";
import { formatPrice } from "@/lib/format";
import {
  computeBreakdown,
  PRICING_DEFAULTS,
  type PriceBreakdown,
  type PricingSettings,
} from "@/lib/pricing";
import { previewOrderPricing } from "@/lib/actions/checkout";

type PublicCoupon = { code: string; type: "PERCENT" | "FIXED"; value: number };

const stepBtn =
  "grid size-11 place-items-center rounded-lg text-foreground/80 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/40";

export function CartView({
  settings = PRICING_DEFAULTS,
  publicCoupons = [],
}: {
  settings?: PricingSettings;
  publicCoupons?: PublicCoupon[];
}) {
  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const mounted = useHydrated();
  // Optimistic client breakdown for instant render; corrected by the server
  // (which re-prices from the DB) so admin delivery/GST values always win.
  const optimistic = computeBreakdown(
    items.map((i) => ({
      unitPrice: i.price,
      quantity: i.quantity,
      gstRate: i.gstRate,
      deliveryCharge: i.deliveryCharge,
    })),
    settings,
  );

  const payload = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );
  const payloadKey = JSON.stringify(payload);
  // Keyed by the cart it priced: a response for an older cart must never
  // outrank the instant optimistic figures for the current one.
  const [server, setServer] = useState<{ key: string; breakdown: PriceBreakdown } | null>(null);

  useEffect(() => {
    if (payload.length === 0) {
      setServer(null);
      return;
    }
    let active = true;
    void previewOrderPricing({ items: payload }).then((res) => {
      if (active && res.ok) setServer({ key: payloadKey, breakdown: res.breakdown });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  // The sticky bar shows whenever the summary's checkout button is off screen.
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const hasItems = mounted && items.length > 0;
  const showSticky = useViewportPosition(ctaRef, hasItems) !== "visible";

  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  if (items.length === 0) return <CartEmpty />;

  const breakdown = server?.key === payloadKey ? server.breakdown : optimistic;
  const { subtotal, shipping, total } = breakdown;
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const freeShippingProgress =
    settings.freeShippingEnabled && settings.freeShippingThreshold > 0
      ? Math.min(100, Math.round((subtotal / settings.freeShippingThreshold) * 100))
      : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 xl:gap-16">
      <div className="min-w-0">
        {/* Free-delivery progress nudge */}
        {freeShippingProgress !== null && (
          <div className="mb-2 rounded-xl bg-oat px-4 py-3.5 text-sm text-oat-foreground">
            {shipping > 0 ? (
              <>
                <p>
                  Add{" "}
                  <span className="font-semibold">
                    {formatPrice(settings.freeShippingThreshold - subtotal)}
                  </span>{" "}
                  more for Free Delivery
                </p>
                <div
                  className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-foreground/10"
                  role="progressbar"
                  aria-label="Progress to Free Delivery"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={freeShippingProgress}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="font-medium">You&apos;ve unlocked Free Delivery</p>
            )}
          </div>
        )}

        <h2 className="sr-only">Items in your cart</h2>
        <ul className="divide-y divide-border border-b border-border">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-4 py-5 sm:gap-5">
              <Link
                href={`/products/${item.slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-oat sm:size-28"
                tabIndex={-1}
                aria-hidden
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 96px, 112px"
                    className="object-cover"
                  />
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.slug}`}
                      className="line-clamp-2 text-[15px] font-medium leading-snug hover:underline hover:underline-offset-4"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.weightLabel} · {formatPrice(item.price)} each
                    </p>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      type="button"
                      className={stepBtn}
                      onClick={() => updateQty(item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className={stepBtn}
                      onClick={() => updateQty(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= (item.maxStock || 99)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Remove ${item.name}`}
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                    <span className="max-[359px]:sr-only">Remove</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button asChild variant="ghost" className="mt-3 h-11 gap-1.5 px-2 text-muted-foreground">
          <Link href="/products">
            <ArrowLeft className="size-4" /> Continue shopping
          </Link>
        </Button>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="font-heading text-subheading">Order summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>

        <div className="mt-5">
          <OrderTotals breakdown={breakdown} />
        </div>

        <Button asChild className="mt-6 h-12 w-full gap-2 rounded-lg text-[15px]">
          <Link href="/checkout" ref={ctaRef}>
            Proceed to checkout
            <ArrowRight className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5" />
          </Link>
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" strokeWidth={1.75} /> Secure checkout · easy returns
        </p>

        {publicCoupons.length > 0 && (
          <div className="mt-6 border-t border-border pt-5 text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              <Gift className="size-4 text-terracotta" strokeWidth={1.75} /> Offers you can use
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {publicCoupons.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
                    {c.code}
                  </span>
                  <span className="text-muted-foreground">
                    {c.type === "PERCENT" ? `${c.value}% off` : `${formatPrice(c.value)} off`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Apply a code at checkout.{" "}
              <Link href="/offers" className="font-medium text-foreground underline underline-offset-4">
                View all offers
              </Link>
            </p>
          </div>
        )}
      </aside>

      <StickyTotalBar show={showSticky} total={total}>
        <Button asChild className="h-12 w-full gap-1.5 rounded-lg text-[15px]">
          <Link href="/checkout">
            Checkout
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </StickyTotalBar>
    </div>
  );
}
