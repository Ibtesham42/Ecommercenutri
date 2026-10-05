import { getRecommendations } from "@/lib/ai/recommendations";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";

/** Server component: a personalized (or best-seller) recommendation strip.
 *  Renders nothing when there are no recommendations to show — so callers
 *  can render it unconditionally (signed-in or guest) without risking an
 *  empty, padded wrapper. */
export async function RecommendedProducts({
  title = "Recommended for you",
  subtitle,
  excludeProductIds,
  limit = 4,
  className,
}: {
  title?: string;
  subtitle?: string;
  excludeProductIds?: string[];
  limit?: number;
  className?: string;
}) {
  const user = await getCurrentUser();
  const [products, wishlistIds] = await Promise.all([
    getRecommendations({ userId: user?.id, excludeProductIds, limit }),
    getWishlistProductIds(),
  ]);

  if (products.length === 0) return null;

  return (
    <section className={className}>
      <SectionHeading title={title} subtitle={subtitle} />
      <ProductGrid products={products} wishlistedIds={wishlistIds} />
    </section>
  );
}
