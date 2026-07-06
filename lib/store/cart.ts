"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  weightLabel: string;
  price: number; // effective unit price in paise
  quantity: number;
  maxStock: number;
  // Pricing overrides (product-level); null/undefined = use the store default.
  // Resolved against store settings at display time (server is authoritative).
  gstRate?: number | null; // GST percent
  deliveryCharge?: number | null; // paise
};

type CartState = {
  items: CartItem[];
  // Increments on every add — a transient signal the header cart icon subscribes
  // to so it can play a "bump" animation. Not used for any pricing/logic.
  bump: number;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      bump: 0,
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          const items = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: Math.min(i.quantity + qty, i.maxStock || 99) }
                  : i,
              )
            : [...state.items, { ...item, quantity: Math.min(qty, item.maxStock || 99) }];
          return { items, bump: state.bump + 1 };
        }),
      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),
      updateQty: (variantId, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId
              ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxStock || 99)) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "nutriyet-cart",
      // Self-heal on rehydrate: drop malformed persisted items (stale schema,
      // manual edits) so a bad entry can never NaN-poison badge/totals/checkout.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CartState>;
        const items = Array.isArray(p.items)
          ? p.items.filter(
              (i): i is CartItem =>
                Boolean(i) &&
                typeof i.variantId === "string" &&
                typeof i.slug === "string" &&
                Number.isFinite(i.price) &&
                Number.isFinite(i.quantity) &&
                i.quantity > 0,
            )
          : [];
        return { ...current, ...p, items };
      },
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.price * i.quantity, 0);
}
