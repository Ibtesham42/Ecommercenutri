import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart-view";
import { RecommendedProducts } from "@/components/storefront/recommended-products";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import { buildMetadata } from "@/lib/seo";
import { getPricingSettings } from "@/lib/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "Your cart",
  path: "/cart",
  noindex: true,
});

export default async function CartPage() {
  const settings = await getPricingSettings();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Your cart</h1>
      <CartView settings={settings} />

      <div className="mt-16 space-y-16">
        <RecommendedProducts title="You might also like" />
        <RecentlyViewed />
      </div>
    </div>
  );
}
