"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/store/cart";
import { ProductGrid } from "@/components/storefront/product-card";
import { cartCrossSell, type CartCrossSellResult } from "@/lib/actions/recommendations";

/** Client cross-sell strip: recommends complementary products based on what's in
 *  the cart (server-computed from real order history). Renders nothing when empty. */
export function CartCrossSell({ title = "Goes well with your cart" }: { title?: string }) {
  const items = useCart((s) => s.items);
  const productIds = useMemo(
    () => [...new Set(items.map((i) => i.productId))],
    [items],
  );
  const key = productIds.join(",");
  const [data, setData] = useState<CartCrossSellResult | null>(null);

  useEffect(() => {
    if (productIds.length === 0) {
      setData(null);
      return;
    }
    let active = true;
    void cartCrossSell({ productIds }).then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!data || data.products.length === 0) return null;

  return (
    <section>
      <h2 className="mb-6 text-xl font-bold sm:text-2xl">{title}</h2>
      <ProductGrid products={data.products} wishlistedIds={new Set(data.wishlistedIds)} />
    </section>
  );
}
