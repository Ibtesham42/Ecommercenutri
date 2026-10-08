/**
 * Catalog URL state (pure, client-safe): the single source of truth for which
 * query params are filters, how they're labelled, and how filter/clear links are
 * built. Param names are the existing public contract — never rename them.
 */

export type CatalogQuery = Record<string, string | undefined>;

/** Mirrors the page size of getProducts / aiProductSearch (display only). */
export const CATALOG_PAGE_SIZE = 12;

/** Params that narrow the result set. `q` and `sort` are not filters. */
export const FILTER_KEYS = ["category", "minPrice", "maxPrice", "onSale", "inStock", "minRating"] as const;

/** Price ranges in rupees ("" = open-ended). */
export const PRICE_RANGES = [
  { label: "Under ₹200", min: "", max: "200" },
  { label: "₹200 – ₹500", min: "200", max: "500" },
  { label: "₹500 – ₹1,000", min: "500", max: "1000" },
  { label: "Over ₹1,000", min: "1000", max: "" },
] as const;

export const RATING_OPTIONS = [4, 3] as const;

/** Which filters a route actually applies (a filter it ignores must not show). */
export type CatalogSupports = { category: boolean; price: boolean };

/** Flatten Next's searchParams to single string values. */
export function toCatalogQuery(sp: Record<string, string | string[] | undefined>): CatalogQuery {
  const q: CatalogQuery = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q[k] = v;
  return q;
}

/** A link to `pathname` with `updates` applied (undefined/"" removes). Always resets `page`. */
export function catalogHref(pathname: string, query: CatalogQuery, updates: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  for (const [k, v] of Object.entries(updates)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Remove every filter; keep the search term and sort. */
export function clearFiltersHref(pathname: string, query: CatalogQuery): string {
  return catalogHref(pathname, query, Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])));
}

const rupees = (v: string) => `₹${Number(v).toLocaleString("en-IN")}`;
const isNum = (v: string | undefined): v is string => !!v && Number.isFinite(Number(v));

export function priceRangeLabel(min: string | undefined, max: string | undefined): string | null {
  const preset = PRICE_RANGES.find((r) => r.min === (min ?? "") && r.max === (max ?? ""));
  if (preset) return preset.label;
  if (isNum(min) && isNum(max)) return `${rupees(min)} – ${rupees(max)}`;
  if (isNum(max)) return `Under ${rupees(max)}`;
  if (isNum(min)) return `Over ${rupees(min)}`;
  return null;
}

export type ActiveFilter = { key: string; label: string; removeHref: string };

/** The filters currently applied, each with a link that removes only it. */
export function activeFilters(
  pathname: string,
  query: CatalogQuery,
  supports: CatalogSupports,
  categoryNames: Record<string, string> = {},
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const remove = (...keys: string[]) => catalogHref(pathname, query, Object.fromEntries(keys.map((k) => [k, undefined])));

  if (supports.category && query.category) {
    out.push({ key: "category", label: categoryNames[query.category] ?? query.category, removeHref: remove("category") });
  }
  if (supports.price) {
    const label = priceRangeLabel(query.minPrice, query.maxPrice);
    if (label) out.push({ key: "price", label, removeHref: remove("minPrice", "maxPrice") });
  }
  if (query.inStock === "1") out.push({ key: "inStock", label: "In stock", removeHref: remove("inStock") });
  if (query.onSale === "1") out.push({ key: "onSale", label: "On sale", removeHref: remove("onSale") });
  if (isNum(query.minRating)) {
    out.push({ key: "minRating", label: `${query.minRating}★ & up`, removeHref: remove("minRating") });
  }
  return out;
}

/** 1-based inclusive range of the items on `page`, e.g. { from: 13, to: 22 }. */
export function resultRange(page: number, perPage: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const from = (page - 1) * perPage + 1;
  return { from, to: Math.min(total, page * perPage) };
}
