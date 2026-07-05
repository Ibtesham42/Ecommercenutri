/**
 * Shared types for the grounded AI recommendation cards — client-safe (no
 * Prisma/server imports). The engine (`lib/ai/recommend.ts`) produces this
 * payload from LIVE catalog data only; the chat route appends it to the text
 * stream after `RECO_MARKER`, and `components/storefront/ai-reco-cards.tsx`
 * renders it. Every field is real database data — nothing here is generated
 * by the language model, so cards can never hallucinate products, prices,
 * pack sizes or stock.
 */

/** Stream delimiter between the assistant's text and the JSON reco payload. */
export const RECO_MARKER = "\n@@NUTRI_RECO@@";

export type RecoStockState = "in" | "popular" | "limited";

export type AiRecoCard = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  category: string;
  /** Default variant — powers Quick Add and the pack-size chip. */
  variantId: string;
  packSize: string;
  /** Effective (sale-aware) unit price in paise. */
  price: number;
  /** Original price in paise (for the strikethrough when discounted). */
  mrp: number;
  discountPct: number | null;
  rating: number | null;
  ratingCount: number;
  stockState: RecoStockState;
  /** Real remaining stock, present only when `stockState === "limited"`. */
  stockLeft: number | null;
  maxStock: number;
  /** Top nutrition/benefit chips (max 3), from real product data. */
  highlights: string[];
  /** Personal, rule-composed "why we recommend this" (from real signals). */
  reason: string;
  // Pricing overrides carried into the cart item (server re-prices anyway).
  gstRate: number | null;
  deliveryCharge: number | null;
};

export type AiRecoPayload = {
  primary: AiRecoCard[];
  crossSell: AiRecoCard[];
  /** Optional context line, e.g. the asked-for product is out of stock. */
  note?: string;
};
