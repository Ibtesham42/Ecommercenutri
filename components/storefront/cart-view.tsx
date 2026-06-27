"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/format";
import {
  computeBreakdown,
  PRICING_DEFAULTS,
  type PricingSettings,
} from "@/lib/pricing";

export function CartView({ settings = PRICING_DEFAULTS }: { settings?: PricingSettings }) {
  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const breakdown = computeBreakdown(
    items.map((i) => ({
      unitPrice: i.price,
      quantity: i.quantity,
      gstRate: i.gstRate,
      deliveryCharge: i.deliveryCharge,
    })),
    settings,
  );
  const { subtotal, shipping, tax, total } = breakdown;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.variantId}
            className="flex gap-4 rounded-xl border p-3"
          >
            <Link
              href={`/products/${item.slug}`}
              className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-accent/30"
            >
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </Link>

            <div className="flex flex-1 flex-col">
              <div className="flex justify-between gap-2">
                <div>
                  <Link
                    href={`/products/${item.slug}`}
                    className="line-clamp-1 text-sm font-semibold hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.weightLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.variantId)}
                  aria-label="Remove item"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center rounded-lg border">
                  <button
                    type="button"
                    className="grid size-8 place-items-center disabled:opacity-40"
                    onClick={() => updateQty(item.variantId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="grid size-8 place-items-center disabled:opacity-40"
                    onClick={() => updateQty(item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= (item.maxStock || 99)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit space-y-4 rounded-2xl border p-5 shadow-elev-1 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
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
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-medium">
              {shipping === 0 ? "Free" : formatPrice(shipping)}
            </span>
          </div>
          {shipping > 0 && settings.freeShippingThreshold > subtotal && (
            <p className="text-xs text-muted-foreground">
              Add {formatPrice(settings.freeShippingThreshold - subtotal)} more for free
              shipping.
            </p>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </aside>
    </div>
  );
}
