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
    <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
