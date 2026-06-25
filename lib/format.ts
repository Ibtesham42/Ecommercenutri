const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a paise amount (integer) as an INR currency string, e.g. 14900 -> "₹149". */
export function formatPrice(paise: number): string {
  return inr.format(paise / 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Discount percentage given MRP and sale price (both in paise), or null. */
export function discountPercent(
  price: number,
  discountPrice?: number | null,
): number | null {
  if (!discountPrice || discountPrice >= price || price <= 0) return null;
  return Math.round(((price - discountPrice) / price) * 100);
}

/** The effective price to charge (sale price if present and valid, else MRP). */
export function effectivePrice(price: number, discountPrice?: number | null): number {
  if (discountPrice && discountPrice > 0 && discountPrice < price) return discountPrice;
  return price;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(input: string, max = 160): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + "…";
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date | string | number): string {
  return dateFmt.format(new Date(date));
}

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date | string | number): string {
  return dateTimeFmt.format(new Date(date));
}
