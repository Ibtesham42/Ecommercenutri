"use client";

import { useEffect, useState } from "react";
import { useCart, cartCount } from "@/lib/store/cart";

export function CartCount() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? cartCount(items) : 0;
  if (count <= 0) return null;

  return (
    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold leading-5 text-gold-foreground shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}
