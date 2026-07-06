"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/storefront/blur-image";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { formatPrice, effectivePrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/queries/products";

type BundleItem = {
  product: ProductCardData;
  variant: NonNullable<ProductCardData["variants"][number]>;
  price: number;
};

/** Pick the variant a one-tap add would use: default+in-stock, else any in-stock. */
function pickVariant(p: ProductCardData) {
  return (
    p.variants.find((v) => v.isDefault && v.stock > 0) ??
    p.variants.find((v) => v.stock > 0) ??
    null
  );
}

/**
 * Amazon-style "Frequently bought together" — an interactive bundle the shopper
 * can add in one tap (all items pre-selected), with a live combined total. A
 * proven AOV lever: turns a passive reco strip into multi-item add-to-cart.
 * Only in-stock products are bundled; renders nothing below 2 items (no bundle).
 * Reuses the cart store + existing pricing — no new server logic.
 */
export function FrequentlyBoughtTogether({
  products,
  className,
}: {
  products: ProductCardData[];
  className?: string;
}) {
  const addItem = useCart((s) => s.addItem);

  const items: BundleItem[] = products
    .slice(0, 3)
    .map((product) => {
      const variant = pickVariant(product);
      return variant
        ? { product, variant, price: effectivePrice(variant.price, variant.discountPrice) }
        : null;
    })
    .filter((x): x is BundleItem => x !== null);

  // All pre-selected (the pattern that lifts AOV); shoppers can deselect.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map((i) => i.product.id)),
  );

  if (items.length < 2) return null;

  const chosen = items.filter((i) => selected.has(i.product.id));
  const total = chosen.reduce((sum, i) => sum + i.price, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addAll() {
    if (chosen.length === 0) return;
    for (const i of chosen) {
      addItem({
        variantId: i.variant.id,
        productId: i.product.id,
        slug: i.product.slug,
        name: i.product.name,
        image: i.product.images[0]?.url ?? null,
        weightLabel: i.variant.weightLabel,
        price: i.price,
        maxStock: i.variant.stock,
      });
      trackClient({ type: "CART_ADD", productId: i.product.id });
    }
    toast.success(
      chosen.length === 1
        ? "Added to cart"
        : `Added ${chosen.length} items to cart`,
    );
  }

  return (
    <section className={className}>
      <h2 className="mb-1 font-heading text-xl font-semibold tracking-tight sm:text-[1.6rem]">Frequently bought together</h2>
      <p className="mb-6 text-muted-foreground">Add the set in one tap — save a trip back.</p>

      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Visual bundle: thumbnails joined by + */}
          <div className="flex flex-wrap items-center gap-3">
            {items.map((i, idx) => {
              const isOn = selected.has(i.product.id);
              return (
                <div key={i.product.id} className="flex items-center gap-3">
                  {idx > 0 && <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <div className="w-24">
                    <button
                      type="button"
                      onClick={() => toggle(i.product.id)}
                      aria-pressed={isOn}
                      aria-label={`${isOn ? "Remove" : "Add"} ${i.product.name} ${isOn ? "from" : "to"} bundle`}
                      className={cn(
                        "group relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted transition-all motion-safe:active:scale-[0.97]",
                        isOn ? "border-primary ring-1 ring-primary" : "opacity-55 hover:opacity-100",
                      )}
                    >
                      {i.product.images[0] && (
                        <BlurImage
                          src={i.product.images[0].url}
                          alt={i.product.images[0].alt ?? i.product.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                      <span
                        className={cn(
                          "absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-md border transition-colors",
                          isOn
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background/80",
                        )}
                      >
                        {isOn && <Check className="size-3.5" />}
                      </span>
                    </button>
                    <Link
                      href={`/products/${i.product.slug}`}
                      className="mt-1.5 line-clamp-2 block text-xs font-medium hover:text-primary"
                    >
                      {i.product.name}
                    </Link>
                    <span className="text-xs font-semibold">{formatPrice(i.price)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total + add all */}
          <div className="shrink-0 lg:w-56 lg:text-right">
            <p className="text-sm text-muted-foreground">
              Total for {chosen.length} {chosen.length === 1 ? "item" : "items"}
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight">{formatPrice(total)}</p>
            <Button
              onClick={addAll}
              disabled={chosen.length === 0}
              className="btn-rich mt-3 h-11 w-full gap-2 font-semibold shadow-elev-1 lg:w-auto lg:px-6"
            >
              <ShoppingCart className="size-4" />
              {chosen.length <= 1 ? "Add to cart" : `Add ${chosen.length} to cart`}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
