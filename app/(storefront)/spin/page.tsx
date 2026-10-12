import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Gift } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/format";
import { productCardSelect } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { isPhoneAuthEnabled } from "@/lib/otp";
import {
  SPIN_COOKIE,
  canClaimSpin,
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
  const [userSpin, tokenSpin, verified] = await Promise.all([
    user && campaign
      ? prisma.spinResult.findUnique({ where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } } })
      : null,
    token ? prisma.spinResult.findUnique({ where: { tokenHash: hashToken(token) } }) : null,
    user ? canClaimSpin(user.id) : false,
  ]);
  const { spin, pendingClaim, needsVerification } = resolveSpinPage({
    liveCampaignId: campaign?.id ?? null,
    signedIn: Boolean(user),
    verified,
    userSpin,
    tokenSpin,
  });
  const view = spin ? await toSpinView(spin) : null;

  // The product grid is for an offer that can still be used — never for an
  // expired win or an offer that's already been redeemed.
  const offerUsable =
    view !== null &&
    (view.status === "AWARDED" || (view.status === "CLAIMED" && !view.coupon?.used));
  const [prizeProduct, wishlistIds] = offerUsable
    ? await Promise.all([
        prisma.product.findFirst({ where: { id: view.productId, isActive: true }, select: productCardSelect }),
        getWishlistProductIds(),
      ])
    : [null, [] as string[]];

  const header = (
    <header>
      <p className="eyebrow">Spin &amp; Win</p>
      <h1 className="mt-3 font-heading text-title text-balance text-foreground">One spin, one honest offer</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
        Spin once for a discount on one of our selected natural foods. The offer applies only to the product you
        win — not your whole cart.
      </p>
    </header>
  );

  return (
    <div className="bg-card">
      <section className="shop-container pt-6 pb-12 sm:pt-8 md:pb-16 lg:pb-20">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Spin & Win" }]} />
        <div className="mt-6 sm:mt-8 lg:mt-10">
          {campaign ? (
            <SpinGame
              campaign={toPublicCampaign(campaign)}
              initialView={view}
              signedIn={Boolean(user)}
              pendingClaim={pendingClaim}
              needsVerification={needsVerification}
              phoneVerifyAvailable={isPhoneAuthEnabled()}
              header={header}
            />
          ) : view ? (
            // Campaign paused/ended but this browser still holds a win — it
            // stays claimable (claims are honoured after a pause). No wheel:
            // the offer is shown on its own.
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
              needsVerification={needsVerification}
              phoneVerifyAvailable={isPhoneAuthEnabled()}
              header={header}
              showWheel={false}
            />
          ) : (
            <div className="max-w-2xl">
              {header}
              <EmptyState
                icon={Gift}
                title="Spin & Win isn't running right now"
                description="New offers are added from time to time — keep an eye on this space."
                action={{ label: "Browse offers", href: "/offers" }}
                className="mt-8"
              />
            </div>
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
              {view?.status === "AWARDED"
                ? "Add it to your cart — the discount applies at checkout once your offer is claimed."
                : "Add it to your cart and apply your code at checkout."}
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
          <div className="shop-container grid gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 id="spin-terms" className="font-heading text-subheading font-medium text-foreground">
                How it works
              </h2>
              <ol className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-1 lg:gap-5">
                {[
                  ["Spin once", "Your result is decided and saved securely by us — one spin per account."],
                  ["Claim it", "Sign in with a verified email or phone, and the offer is saved to your account."],
                  ["Use it at checkout", `Apply your code within ${campaign.offerValidDays} days — it's single use.`],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-sm font-medium text-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-foreground">{title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="font-heading text-subheading font-medium text-foreground">Offer terms</h3>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
                <li>The discount applies only to the product you win, in the sizes shown, while stock lasts.</li>
                <li>{SALE_RULE[campaign.saleMode]}</li>
                <li>One offer per order — it can&apos;t be combined with another coupon.</li>
                {campaign.minOrder ? <li>Minimum order {formatPrice(campaign.minOrder)}.</li> : null}
                {campaign.maxDiscount ? <li>Maximum discount {formatPrice(campaign.maxDiscount)}.</li> : null}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
