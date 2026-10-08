import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { getPublicCoupons } from "@/lib/queries/offers";
import { CopyCouponButton } from "@/components/storefront/copy-coupon-button";
import { EmptyState } from "@/components/storefront/empty-state";
import {
  CONTENT_PAGE_CLASS,
  PageHeader,
} from "@/components/storefront/page-header";
import { formatPrice, formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Offers & Coupons",
  description: "All active Nutriyet discount codes in one place.",
  path: "/offers",
});

function valueLabel(c: { type: string; value: number }) {
  return c.type === "PERCENT"
    ? `${c.value}% OFF`
    : `${formatPrice(c.value)} OFF`;
}

export default async function OffersPage() {
  const coupons = await getPublicCoupons();

  return (
    <div className={CONTENT_PAGE_CLASS}>
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Offers" }]}
        eyebrow="Offers"
        title="Offers & coupons"
        lede="Every active discount code, in one place — copy and apply at checkout."
      />

      {coupons.length === 0 ? (
        <EmptyState
          className="mt-10 sm:mt-12"
          icon={Tag}
          title="No public offers right now"
          description="Check back soon — new coupons are added regularly."
          action={{ label: "Continue shopping", href: "/products" }}
        />
      ) : (
        <ul className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => (
            <li
              key={c.id}
              className="flex flex-col rounded-xl bg-oat p-6 text-oat-foreground"
            >
              <div className="flex-1">
                <p className="font-heading text-heading font-medium text-foreground">
                  {valueLabel(c)}
                </p>
                {c.description && (
                  <p className="mt-2 text-[15px] leading-relaxed">
                    {c.description}
                  </p>
                )}
                {(c.minOrder || c.expiresAt) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[
                      c.minOrder
                        ? `Min. order ${formatPrice(c.minOrder)}`
                        : null,
                      c.expiresAt
                        ? `Valid till ${formatDate(c.expiresAt)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed border-foreground/25 pt-4">
                <span className="font-mono text-base font-semibold tracking-[0.15em] text-foreground">
                  {c.code}
                </span>
                <CopyCouponButton
                  code={c.code}
                  className="h-11 rounded-lg border-foreground/30 bg-transparent px-4"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
