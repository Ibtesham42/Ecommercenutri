"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Truck, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/format";
import {
  computeBreakdown,
  PRICING_DEFAULTS,
  type PriceBreakdown,
  type PricingSettings,
} from "@/lib/pricing";
import { previewOrderPricing } from "@/lib/actions/checkout";

export function CartView({ settings = PRICING_DEFAULTS }: { settings?: PricingSettings }) {
  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  const [server, setServer] = useState<PriceBreakdown | null>(null);

  useEffect(() => {
    if (payload.length === 0) {
      setServer(null);
      return;
    }
    let active = true;
    void previewOrderPricing({ items: payload }).then((res) => {
      if (active && res.ok) setServer(res.breakdown);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add some wholesome goodness to get started."
        action={{ label: "Browse products", href: "/products" }}
      />
    );
  }

  const { subtotal, shipping, shippingSaved, tax, total } = server ?? optimistic;
  const freeShippingProgress =
    settings.freeShippingEnabled && settings.freeShippingThreshold > 0
      ? Math.min(100, Math.round((subtotal / settings.freeShippingThreshold) * 100))
      : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {/* Free-delivery progress nudge */}
        {freeShippingProgress !== null && shipping > 0 && (
          <div className="rounded-2xl border bg-accent/30 p-4">
            <p className="text-sm">
              Add{" "}
              <span className="font-semibold text-primary">
                {formatPrice(settings.freeShippingThreshold - subtotal)}
              </span>{" "}
              more for <span className="font-semibold">Free Delivery</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        )}
        {freeShippingProgress !== null && shipping === 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-medium text-primary">
            <Truck className="size-4" /> You&apos;ve unlocked Free Delivery!
          </div>
        )}

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex gap-4 rounded-2xl border bg-card p-3 shadow-elev-1 sm:p-4"
            >
              <Link
                href={`/products/${item.slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted"
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.slug}`}
                      className="line-clamp-2 text-sm font-semibold hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.weightLabel} · {formatPrice(item.price)} each
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label="Remove item"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mx-auto size-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-xl border">
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-l-xl transition-colors hover:bg-accent disabled:opacity-40"
                      onClick={() => updateQty(item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-r-xl transition-colors hover:bg-accent disabled:opacity-40"
                      onClick={() => updateQty(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= (item.maxStock || 99)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-base font-bold tracking-tight">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link href="/products">
            <ArrowLeft className="size-4" /> Continue shopping
          </Link>
        </Button>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-elev-1 lg:sticky lg:top-24">
        <h2 className="font-heading text-lg font-semibold">Order summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (incl.)</span>
              <span className="font-medium">{formatPrice(tax)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className={shipping === 0 ? "font-semibold text-primary" : "font-medium"}>
              {shipping === 0 ? "Free Delivery" : formatPrice(shipping)}
            </span>
          </div>
          {shipping === 0 && shippingSaved > 0 && (
            <p className="text-xs font-medium text-primary">
              You saved {formatPrice(shippingSaved)} on shipping
            </p>
          )}
          <div className="mt-1 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
        <Button asChild size="lg" className="h-12 w-full text-base shadow-elev-1">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Secure checkout · easy returns
        </div>
      </aside>

      {/* Sticky mobile checkout bar (bottom nav is hidden on /cart). */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="truncate text-base font-bold leading-tight">
              {formatPrice(total)}
            </p>
          </div>
          <Button asChild size="lg" className="h-12 flex-1 text-base">
            <Link href="/checkout">Checkout</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
