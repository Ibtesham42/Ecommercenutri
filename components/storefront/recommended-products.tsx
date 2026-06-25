import { getRecommendations } from "@/lib/ai/recommendations";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";

/** Server component: a personalized (or best-seller) recommendation strip. */
export async function RecommendedProducts({
  title = "Recommended for you",
  subtitle,
  excludeProductIds,
  limit = 4,
}: {
  title?: string;
  subtitle?: string;
  excludeProductIds?: string[];
  limit?: number;
}) {
  const user = await getCurrentUser();
  const [products, wishlistIds] = await Promise.all([
    getRecommendations({ userId: user?.id, excludeProductIds, limit }),
    getWishlistProductIds(),
  ]);

  if (products.length === 0) return null;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      <ProductGrid products={products} wishlistedIds={wishlistIds} />
    </section>
  );
}
