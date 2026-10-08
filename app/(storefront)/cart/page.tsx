import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart-view";
import { CartCrossSell } from "@/components/storefront/cart-cross-sell";
import { RecommendedProducts } from "@/components/storefront/recommended-products";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import { buildMetadata } from "@/lib/seo";
import { getPricingSettings } from "@/lib/queries/settings";
import { getPublicCoupons } from "@/lib/queries/offers";

export const metadata: Metadata = buildMetadata({
  title: "Your cart",
  path: "/cart",
  noindex: true,
});

export default async function CartPage() {
  const [settings, publicCoupons] = await Promise.all([
    getPricingSettings(),
    getPublicCoupons(),
  ]);
  return (
    <div className="shop-container pt-6 pb-28 sm:pt-8 lg:pb-24">
      <header className="mb-6 sm:mb-8">
        <p className="eyebrow">Cart</p>
        <h1 className="mt-2 font-heading text-title text-foreground sm:mt-3">Your cart</h1>
      </header>
      <CartView
        settings={settings}
        publicCoupons={publicCoupons.slice(0, 2).map((c) => ({
          code: c.code,
          type: c.type,
          value: c.value,
        }))}
      />

      <div className="mt-16 space-y-16 lg:mt-24 lg:space-y-24">
        <CartCrossSell />
        <RecommendedProducts title="You might also like" />
        <RecentlyViewed />
      </div>
    </div>
  );
}
