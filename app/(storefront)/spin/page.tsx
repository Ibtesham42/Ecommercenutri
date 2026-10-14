import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, Clock, Gift, Percent } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/format";
import { productCardSelect } from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { isPhoneAuthEnabled } from "@/lib/otp";
import { getStoreSettings } from "@/lib/queries/settings";
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
import { Button } from "@/components/ui/button";
import { SpinGame } from "@/components/storefront/spin/spin-game";
import { SpinWheel } from "@/components/storefront/spin/spin-wheel";

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
  const [user, campaign, jar, settings] = await Promise.all([
    getCurrentUser(),
    getLiveCampaign(),
    cookies(),
    getStoreSettings(),
  ]);

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

  const publicCampaign = campaign ? toPublicCampaign(campaign) : null;
  const topPercent = publicCampaign ? Math.max(0, ...publicCampaign.percents) : 0;
  const facts = publicCampaign
    ? [
        { icon: Percent, title: `Up to ${topPercent}% off`, body: "on one selected product" },
        { icon: Gift, title: "One spin", body: "per account" },
        { icon: Clock, title: `${publicCampaign.claimWindowHours} hours`, body: "to claim your win" },
      ]
    : [];

  // Header on the dark stage. With the wheel on screen, phones drop the intro
  // paragraph and the facts row: the stage's own caption says the same thing,
  // and it keeps wheel + Spin button above the fold.
  const header = (withWheel: boolean, title = "One spin, one honest offer", intro?: string) => (
    <header>
      <p className="text-xs font-semibold tracking-[0.18em] text-(--spin-gold) uppercase">Spin &amp; Win</p>
      <h1 className="mt-2.5 font-heading text-title text-balance text-(--spin-fg) sm:mt-3">{title}</h1>
      <p
        className={`mt-3 max-w-xl text-[15px] leading-relaxed text-(--spin-fg-muted) sm:mt-4 sm:text-lg ${withWheel ? "max-sm:hidden" : ""}`}
      >
        {intro ??
          "Spin once for a discount on one of our selected natural foods. The offer applies only to the product you win — not your whole cart."}
      </p>
      {withWheel && facts.length > 0 && (
        <ul className="mt-8 hidden gap-x-8 gap-y-4 sm:flex sm:flex-wrap">
          {facts.map((f) => (
            <li key={f.title} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-(--spin-gold)/45 text-(--spin-gold)">
                <f.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold text-(--spin-fg)">{f.title}</span>
                <span className="text-(--spin-fg-muted)">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </header>
  );

  return (
    <div>
      <div className="shop-container pt-4 pb-4 sm:pt-6 sm:pb-6">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Spin & Win" }]} />
      </div>
      {/* The stage: one deep-forest band holds the whole game in every state. */}
      <section aria-label="Spin & Win" className="spin-stage">
        <div className="shop-container pt-6 pb-10 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-20">
          {publicCampaign ? (
            <SpinGame
              campaign={publicCampaign}
              initialView={view}
              signedIn={Boolean(user)}
              pendingClaim={pendingClaim}
              needsVerification={needsVerification}
              phoneVerifyAvailable={isPhoneAuthEnabled()}
              header={header(true)}
              logoUrl={settings.logo}
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
              header={header(false)}
              showWheel={false}
            />
          ) : (
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center lg:gap-16 xl:gap-24">
              <div className="max-w-2xl">
                {header(
                  false,
                  "Spin & Win isn’t running right now",
                  "New offers are added from time to time — keep an eye on this space. Meanwhile, today’s offers are open to everyone.",
                )}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    className="h-12 rounded-xl border-transparent bg-(--spin-gold) px-6 text-[15px] font-semibold text-(--spin-gold-fg) hover:bg-(--spin-gold-hover)"
                  >
                    <Link href="/offers">
                      Browse offers <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-xl border-(--spin-fg)/30 bg-transparent px-6 text-[15px] text-(--spin-fg) hover:bg-(--spin-ground-raised) hover:text-(--spin-fg)"
                  >
                    <Link href="/products">Shop all products</Link>
                  </Button>
                </div>
              </div>
              {/* Resting wheel (desktop): keeps the page's identity while nothing runs —
                  unlabelled, so it never implies an offer. */}
              <SpinWheel
                percents={[1, 2, 3, 4, 5, 6]}
                rotation={0}
                durationMs={0}
                showLabels={false}
                logoUrl={settings.logo}
                className="hidden w-full opacity-30 lg:block"
              />
            </div>
          )}
        </div>
      </section>

      {prizeProduct && (
        <section aria-labelledby="spin-products">
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
        <section aria-labelledby="spin-terms" className={prizeProduct ? "border-t border-border" : undefined}>
          <div className="shop-container shop-section">
            <h2 id="spin-terms" className="font-heading text-heading font-medium text-foreground">
              How it works
            </h2>
            <ol className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-5">
              {[
                ["Spin once", "Your result is decided and saved securely by us — one spin per account."],
                ["Claim it", "Sign in with a verified email or phone, and the offer is saved to your account."],
                ["Use it at checkout", `Apply your code within ${campaign.offerValidDays} days — it's single use.`],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4 rounded-xl border border-border bg-card p-5 sm:flex-col sm:gap-4 sm:p-6">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-heading text-base text-primary-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-foreground">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl bg-oat px-5 py-5 text-oat-foreground sm:px-6">
              <h3 className="font-sans text-sm font-semibold tracking-[0.12em] uppercase">Offer terms</h3>
              <ul className="mt-3 grid gap-x-10 gap-y-2 text-sm leading-relaxed sm:grid-cols-2">
                {[
                  "The discount applies only to the product you win, in the sizes shown, while stock lasts.",
                  SALE_RULE[campaign.saleMode],
                  "One offer per order — it can’t be combined with another coupon.",
                  ...(campaign.minOrder ? [`Minimum order ${formatPrice(campaign.minOrder)}.`] : []),
                  ...(campaign.maxDiscount ? [`Maximum discount ${formatPrice(campaign.maxDiscount)}.`] : []),
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
