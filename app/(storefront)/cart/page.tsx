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
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Your cart</h1>
      <CartView
        settings={settings}
        publicCoupons={publicCoupons.slice(0, 2).map((c) => ({
          code: c.code,
          type: c.type,
          value: c.value,
        }))}
      />

      <div className="mt-16 space-y-16">
        <CartCrossSell />
        <RecommendedProducts title="You might also like" />
        <RecentlyViewed />
      </div>
    </div>
  );
}
