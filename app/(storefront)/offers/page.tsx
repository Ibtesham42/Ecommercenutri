import type { Metadata } from "next";
import { Gift, Tag } from "lucide-react";
import { getPublicCoupons } from "@/lib/queries/offers";
import { CopyCouponButton } from "@/components/storefront/copy-coupon-button";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatPrice, formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Offers & Coupons",
  description: "All active Nutriyet discount codes in one place.",
  path: "/offers",
});

function valueLabel(c: { type: string; value: number }) {
  return c.type === "PERCENT" ? `${c.value}% OFF` : `${formatPrice(c.value)} OFF`;
}

export default async function OffersPage() {
  const coupons = await getPublicCoupons();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Gift className="size-6" />
        </span>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Offers &amp; Coupons</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every active discount code, in one place — copy and apply at checkout.
        </p>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No public offers right now"
          description="Check back soon — new coupons are added regularly."
          action={{ label: "Continue shopping", href: "/products" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-elev-1"
            >
              <div>
                <span className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold-foreground">
                  {valueLabel(c)}
                </span>
                {c.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                )}
                <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {c.minOrder ? <p>Min. order {formatPrice(c.minOrder)}</p> : null}
                  {c.expiresAt ? <p>Valid till {formatDate(c.expiresAt)}</p> : null}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5">
                <span className="font-mono text-base font-bold tracking-[0.15em] text-primary">
                  {c.code}
                </span>
                <CopyCouponButton code={c.code} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
