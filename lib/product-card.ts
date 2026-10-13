import { discountPercent, effectivePrice } from "@/lib/format";

/** Product grid columns follow the space the grid actually gets (container
 *  queries — wrap in `@container`), so a PLP beside a filter sidebar and a
 *  full-width homepage section both land on comfortable card widths:
 *  2 → 3 (≥576px) → 4 (≥896px). Capped at 4: five-up made cards small and
 *  left ragged last rows for the usual 8-product sections. Shared by grid + skeleton. */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 @xl:grid-cols-3 @4xl:grid-cols-4";

/** Catalog pages (no sidebar below `lg`): pin 3 columns across 576–1023px, where
 *  the container queries alone would give 2 (narrow) or 4 (near 1000px). `!`
 *  because media vs container query rules have no reliable relative order. */
export const CATALOG_GRID_CLASS = "min-[36rem]:max-lg:grid-cols-3!";

/** A "Bestseller" badge only means something when it singles a product out:
 *  when most products in a grid carry the flag, the badge is just noise. */
export function bestSellerBadgeMeaningful(products: readonly { isBestSeller: boolean }[]): boolean {
  if (products.length === 0) return false;
  return products.filter((p) => p.isBestSeller).length * 2 <= products.length;
}

/** Stock at or below this shows a quiet "Only N left" note (real stock, never invented). */
export const LOW_STOCK_THRESHOLD = 5;

type CardVariant = {
  weightLabel: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  isDefault: boolean;
};

export type ProductCardBadge = "soldOut" | "bestSeller";

export type ProductCardView = {
  /** Effective price shown (paise). For multi-size products it's the cheapest size. */
  price: number;
  /** MRP of the SAME variant as `price`, only when it's genuinely higher. */
  mrp: number | null;
  /** Whole-number discount on that same variant, or null. */
  off: number | null;
  /** "From" prefix applies — more than one size on offer. */
  fromPrice: boolean;
  /** "100g", or "100g · 200 gm" for a few sizes, or "4 sizes". */
  sizeLabel: string | null;
  outOfStock: boolean;
  /** Units left when low (1–5), else null. */
  lowStock: number | null;
  /** At most ONE badge per card: sold out beats bestseller. */
  badge: ProductCardBadge | null;
};

/**
 * Pure, client-safe view model for a product card (single source of truth for
 * what a card displays — the card and Quick View both read it). Display only:
 * the cart still re-prices authoritatively server-side at checkout.
 *
 * Multi-size products show the cheapest size's price, struck MRP and discount
 * together, so "From ₹125" is never paired with another size's MRP.
 */
export function productCardView(
  product: { isBestSeller: boolean; variants: CardVariant[] },
  { showBestSeller = true }: { showBestSeller?: boolean } = {},
): ProductCardView {
  const variants = product.variants;
  const multiple = variants.length > 1;
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  const shown = multiple
    ? variants.reduce((min, v) =>
        effectivePrice(v.price, v.discountPrice) < effectivePrice(min.price, min.discountPrice) ? v : min,
      )
    : defaultVariant;

  const price = shown ? effectivePrice(shown.price, shown.discountPrice) : 0;
  const off = shown ? discountPercent(shown.price, shown.discountPrice) : null;

  const totalStock = variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  const outOfStock = totalStock <= 0;

  let sizeLabel: string | null = null;
  if (multiple) {
    sizeLabel =
      variants.length <= 3
        ? variants.map((v) => v.weightLabel).join(" · ")
        : `${variants.length} sizes`;
  } else if (defaultVariant?.weightLabel) {
    sizeLabel = defaultVariant.weightLabel;
  }

  return {
    price,
    mrp: off && shown ? shown.price : null,
    off,
    fromPrice: multiple,
    sizeLabel,
    outOfStock,
    lowStock: !outOfStock && totalStock <= LOW_STOCK_THRESHOLD ? totalStock : null,
    badge: outOfStock ? "soldOut" : product.isBestSeller && showBestSeller ? "bestSeller" : null,
  };
}
