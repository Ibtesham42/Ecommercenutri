"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { CartCount } from "@/components/storefront/cart-count";
import { cn } from "@/lib/utils";

/**
 * Header cart icon + count badge. Subscribes to the cart store's `bump` signal so
 * it plays a brief "bump" animation whenever an item is added (from anywhere).
 * The badge keeps its original absolute positioning relative to the cart Button.
 */
export function CartIcon() {
  const bump = useCart((s) => s.bump);
  const [anim, setAnim] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Skip the initial mount / store hydration so it only animates on real adds.
    if (first.current) {
      first.current = false;
      return;
    }
    setAnim(true);
    const t = setTimeout(() => setAnim(false), 480);
    return () => clearTimeout(t);
  }, [bump]);

  return (
    <>
      <span className={cn("inline-grid place-items-center", anim && "cart-bump")}>
        <ShoppingCart className="size-5" />
      </span>
      <CartCount />
    </>
  );
}
