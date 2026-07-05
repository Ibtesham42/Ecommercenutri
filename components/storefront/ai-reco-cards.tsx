"use client";

import Link from "next/link";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { Star, Truck, Sparkles, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/format";
import { cldUrl } from "@/lib/cld";
import type { AiRecoCard, AiRecoPayload } from "@/lib/ai/reco-types";

/**
 * Product cards rendered under an assistant reply. Every field comes from the
 * grounded reco engine (live DB rows, in-stock only) — the model never writes
 * card data, so nothing here can be hallucinated. Quick Add mirrors the
 * storefront quick-add exactly (client cart is optimistic; checkout re-prices).
 */

function StockBadge({ card }: { card: AiRecoCard }) {
  if (card.stockState === "limited") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        🟡 Only {card.stockLeft} left — order soon
      </span>
    );
  }
  if (card.stockState === "popular") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        🟢 Popular choice
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      🟢 In stock
    </span>
  );
}

function useQuickAdd(card: AiRecoCard) {
  const addItem = useCart((s) => s.addItem);
  return () => {
    addItem(
      {
        variantId: card.variantId,
        productId: card.id,
        slug: card.slug,
        name: card.name,
        image: card.image,
        weightLabel: card.packSize,
        price: card.price,
        maxStock: card.maxStock,
        gstRate: card.gstRate,
        deliveryCharge: card.deliveryCharge,
      },
      1,
    );
    trackClient({ type: "CART_ADD", productId: card.id });
    toast.success(`Added ${card.name} (${card.packSize}) to cart`);
  };
}

function RecoCard({ card, delivery }: { card: AiRecoCard; delivery: string }) {
  const add = useQuickAdd(card);
  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-elev-1">
      <div className="flex gap-3 p-3">
        <Link
          href={`/products/${card.slug}`}
          onClick={() => trackClient({ type: "RECO_CLICK", productId: card.id })}
          className="shrink-0"
        >
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- chat card thumb, any-host safe via cldUrl no-op
            <img
              src={cldUrl(card.image, { w: 160, h: 160, crop: "fill" })}
              alt={card.name}
              className="size-20 rounded-lg border object-cover"
              loading="lazy"
            />
          ) : (
            <span className="grid size-20 place-items-center rounded-lg bg-accent text-primary">
              <Sparkles className="size-6" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={`/products/${card.slug}`}
              onClick={() => trackClient({ type: "RECO_CLICK", productId: card.id })}
              className="truncate text-sm font-semibold hover:text-primary"
            >
              {card.name}
            </Link>
            {card.rating != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="size-3 fill-gold text-gold" />
                {card.rating.toFixed(1)} ({card.ratingCount})
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-accent px-2 py-0.5">{card.packSize}</span>
            {card.highlights.map((h) => (
              <span key={h} className="rounded-full bg-accent/60 px-2 py-0.5">
                {h}
              </span>
            ))}
          </div>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-sm font-bold">{formatPrice(card.price)}</span>
            {card.discountPct != null && (
              <>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(card.mrp)}
                </span>
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold-foreground dark:text-gold">
                  {card.discountPct}% off
                </span>
              </>
            )}
          </div>

          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            💡 {card.reason}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-accent/20 px-3 py-2">
        <StockBadge card={card} />
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Truck className="size-3" /> Delivery by {delivery}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <AddToCartButton
            onAdd={add}
            label="Add"
            addedLabel="Added"
            variant="default"
            size="sm"
            iconClassName="size-3.5"
            className="h-8 gap-1 rounded-lg px-3 text-xs font-semibold"
          />
          <Link
            href={`/products/${card.slug}`}
            onClick={() => trackClient({ type: "RECO_CLICK", productId: card.id })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            View <ArrowRight className="size-3" />
          </Link>
        </span>
      </div>
    </div>
  );
}

function CrossSellCard({ card }: { card: AiRecoCard }) {
  const add = useQuickAdd(card);
  return (
    <div className="flex w-44 shrink-0 flex-col overflow-hidden rounded-xl border bg-background shadow-elev-1">
      <Link
        href={`/products/${card.slug}`}
        onClick={() => trackClient({ type: "RECO_CLICK", productId: card.id })}
      >
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- chat card thumb
          <img
            src={cldUrl(card.image, { w: 240, h: 160, crop: "fill" })}
            alt={card.name}
            className="h-20 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-20 w-full place-items-center bg-accent text-primary">
            <Sparkles className="size-5" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <Link
          href={`/products/${card.slug}`}
          onClick={() => trackClient({ type: "RECO_CLICK", productId: card.id })}
          className="line-clamp-1 text-xs font-semibold hover:text-primary"
        >
          {card.name}
        </Link>
        <span className="text-xs font-bold">{formatPrice(card.price)}</span>
        <AddToCartButton
          onAdd={add}
          label="Add"
          addedLabel="Added"
          variant="outline"
          size="sm"
          iconClassName="size-3.5"
          className="mt-auto h-7 w-full gap-1 rounded-lg text-[11px] font-semibold"
        />
      </div>
    </div>
  );
}

export function AiRecoCards({ payload }: { payload: AiRecoPayload }) {
  const delivery = `${format(addDays(new Date(), 3), "d MMM")}–${format(addDays(new Date(), 5), "d MMM")}`;
  if (payload.primary.length === 0 && payload.crossSell.length === 0) return null;

  return (
    <div className="w-full space-y-2.5">
      {payload.note && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {payload.note}
        </p>
      )}

      {payload.primary.map((card) => (
        <RecoCard key={card.id} card={card} delivery={delivery} />
      ))}

      {payload.crossSell.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            You may also like
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {payload.crossSell.map((card) => (
              <CrossSellCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
