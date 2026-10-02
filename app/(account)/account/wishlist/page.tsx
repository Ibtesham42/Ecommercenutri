import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getWishlistProducts } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/storefront/empty-state";
import { WishlistBulkAdd } from "@/components/storefront/wishlist-bulk-add";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const products = await getWishlistProducts();
  const ids = new Set(products.map((p) => p.id));

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here for later."
        action={{ label: "Browse products", href: "/products" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {products.length} item{products.length === 1 ? "" : "s"} saved
        </p>
        <WishlistBulkAdd products={products} />
      </div>
      <ProductGrid products={products} wishlistedIds={ids} />
    </div>
  );
}
