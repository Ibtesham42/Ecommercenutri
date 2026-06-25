import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getWishlistProducts } from "@/lib/queries/wishlist";
import { ProductGrid } from "@/components/storefront/product-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const products = await getWishlistProducts();
  const ids = new Set(products.map((p) => p.id));

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <Heart className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-3 font-medium">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the heart on any product to save it here.
        </p>
        <Button asChild className="mt-5">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  return <ProductGrid products={products} wishlistedIds={ids} />;
}
