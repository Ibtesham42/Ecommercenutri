import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getWishlistProducts } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/storefront/empty-state";

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

  return <ProductGrid products={products} wishlistedIds={ids} />;
}
