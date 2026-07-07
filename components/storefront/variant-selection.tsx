"use client";

import { createContext, useContext, useState } from "react";

/**
 * Shared PDP variant selection. The purchase panel drives it; the gallery,
 * description and nutrition islands read it — so picking a variant switches
 * the whole page instantly (no reload, keyed remounts fade the swaps in).
 * Every consumer falls back to product-level data when the variant has none,
 * which keeps existing products rendering exactly as before.
 */
const VariantSelectionContext = createContext<{
  variantId: string | null;
  setVariantId: (id: string) => void;
} | null>(null);

export function VariantSelectionProvider({
  initialId,
  children,
}: {
  initialId: string | null;
  children: React.ReactNode;
}) {
  const [variantId, setVariantId] = useState<string | null>(initialId);
  return (
    <VariantSelectionContext.Provider value={{ variantId, setVariantId }}>
      {children}
    </VariantSelectionContext.Provider>
  );
}

/** Null outside a provider — consumers then behave product-level only. */
export function useVariantSelection() {
  return useContext(VariantSelectionContext);
}

/** Description tab body: the selected variant's own copy, or the product's. */
export function VariantDescription({
  fallback,
  variants,
}: {
  fallback: string;
  variants: { id: string; description: string | null }[];
}) {
  const selection = useVariantSelection();
  const active = variants.find((v) => v.id === selection?.variantId);
  const text = active?.description?.trim() ? active.description : fallback;
  return (
    // Keyed by source so switching variants replays the fade-in.
    <p
      key={active?.description?.trim() ? active.id : "product"}
      className="whitespace-pre-line motion-safe:animate-fade-in"
    >
      {text}
    </p>
  );
}

/** Selected variant's nutrition label image (hidden when it has none). */
export function VariantNutritionImage({
  variants,
  name,
}: {
  variants: { id: string; nutritionImageUrl: string | null }[];
  name: string;
}) {
  const selection = useVariantSelection();
  const url = variants.find((v) => v.id === selection?.variantId)?.nutritionImageUrl;
  if (!url) return null;
  return (
    <div
      key={url}
      className="overflow-hidden rounded-2xl border bg-card shadow-elev-1 motion-safe:animate-fade-in"
    >
      {/* Plain <img>: admin may paste any-host URLs (same policy as stories). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${name} — nutrition information`}
        className="w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}
