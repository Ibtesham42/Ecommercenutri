import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Gift } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/format";
import { productCardSelect } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import {
  SPIN_COOKIE,
  getLiveCampaign,
  hashToken,
  toPublicCampaign,
  toSpinView,
} from "@/lib/spin/service";
import { resolveSpinPage } from "@/lib/spin/page-state";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/storefront/empty-state";
import { SpinGame } from "@/components/storefront/spin/spin-game";

export const metadata: Metadata = buildMetadata({
  title: "Spin & Win",
  description: "Spin the Nutriyet wheel for an offer on selected natural foods.",
  path: "/spin",
  noindex: true,
});

const SALE_RULE: Record<string, string> = {
  BEST_OF: "Offers don't stack on sale prices — you simply pay whichever price is lower.",
  EXCLUDE: "Items that are already on sale aren't discounted further.",
  STACK: "The offer is applied on top of the current price.",
};

export default async function SpinPage() {
  const [user, campaign, jar] = await Promise.all([getCurrentUser(), getLiveCampaign(), cookies()]);

  const token = jar.get(SPIN_COOKIE)?.value;
  const [userSpin, tokenSpin] = await Promise.all([
    user && campaign
      ? prisma.spinResult.findUnique({ where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } } })
      : null,
    token ? prisma.spinResult.findUnique({ where: { tokenHash: hashToken(token) } }) : null,
  ]);
  const { spin, pendingClaim } = resolveSpinPage({
    liveCampaignId: campaign?.id ?? null,
    signedIn: Boolean(user),
    userSpin,
    tokenSpin,
  });
  const view = spin ? await toSpinView(spin) : null;

  const [prizeProduct, wishlistIds] =
    view && view.status !== "EXPIRED"
      ? await Promise.all([
          prisma.product.findFirst({ where: { id: view.productId, isActive: true }, select: productCardSelect }),
          getWishlistProductIds(),
        ])
      : [null, [] as string[]];

  return (
    <div className="bg-card">
      <section className="shop-container pt-6 pb-14 sm:pt-8 md:pb-18 lg:pb-24">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Spin & Win" }]} />
        <header className="mt-6 max-w-2xl sm:mt-8">
          <p className="eyebrow">Spin &amp; Win</p>
          <h1 className="mt-3 font-heading text-title text-foreground">One spin, one honest offer</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
            Spin once for a discount on one of our selected natural foods. The offer applies only to
            the product you win — not your whole cart.
          </p>
        </header>

        <div className="mt-10 sm:mt-12">
          {campaign ? (
            <SpinGame
              campaign={toPublicCampaign(campaign)}
              initialView={view}
              signedIn={Boolean(user)}
              pendingClaim={pendingClaim}
            />
          ) : view ? (
            // Campaign paused/ended but this browser still holds a win — it
            // stays claimable (claims are honoured after a pause).
            <SpinGame
              campaign={{
                id: "",
                name: "",
                percents: [view.percent],
                endsAt: null,
                claimWindowHours: 0,
                offerValidDays: 0,
                minOrder: null,
                maxDiscount: null,
                saleMode: "BEST_OF",
              }}
              initialView={view}
              signedIn={Boolean(user)}
              pendingClaim={pendingClaim}
            />
          ) : (
            <EmptyState
              icon={Gift}
              title="Spin & Win isn't running right now"
              description="Keep an eye on this space — new offers are added from time to time."
              action={{ label: "Browse offers", href: "/offers" }}
            />
          )}
        </div>
      </section>

      {prizeProduct && (
        <section aria-labelledby="spin-products" className="border-t border-border bg-background">
          <div className="shop-container shop-section">
            <h2 id="spin-products" className="font-heading text-heading font-medium text-foreground">
              Your offer applies to
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Add it to your cart — the discount is applied at checkout once your offer is claimed.
            </p>
            <ProductGrid
              products={[prizeProduct]}
              wishlistedIds={wishlistIds}
              className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            />
          </div>
        </section>
      )}

      {campaign && (
        <section aria-labelledby="spin-terms" className="border-t border-border">
          <div className="shop-container py-10 sm:py-12">
            <h2 id="spin-terms" className="font-heading text-subheading font-medium text-foreground">
              How it works
            </h2>
            <ul className="mt-4 grid max-w-3xl gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>· One spin per account for this campaign. Your result is decided and saved securely by us.</li>
              <li>· The discount applies only to the product you win, in the sizes shown, while stock lasts.</li>
              <li>· {SALE_RULE[campaign.saleMode]}</li>
              <li>
                · Claimed offers are valid for {campaign.offerValidDays} days, single use, and can&apos;t be
                combined with another coupon.
                {campaign.minOrder ? ` Minimum order ${formatPrice(campaign.minOrder)}.` : ""}
                {campaign.maxDiscount ? ` Maximum discount ${formatPrice(campaign.maxDiscount)}.` : ""}
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
