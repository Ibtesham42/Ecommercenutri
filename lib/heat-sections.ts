/**
 * Website-heatmap section registry (client-safe; no server imports).
 *
 * A section is any storefront element carrying a `data-heat="<key>"` attribute.
 * The EngagementTracker aggregates clicks/hovers/visible-time per key in the
 * browser and beacons ONE batched payload per page to /api/heat, which
 * increment-upserts a daily HeatStat row — so tracking adds no per-interaction
 * network chatter or DB rows. The server accepts only keys listed here.
 *
 * To track a new area: add its key + label below, then put
 * `data-heat="<key>"` on the element/container. Nothing else to wire.
 */

export const HEAT_SECTIONS: Record<string, string> = {
  hero: "Homepage Hero",
  "hero-slider": "Hero Slider",
  "search-bar": "Search Bar",
  categories: "Categories",
  "product-card": "Product Cards",
  "add-to-cart": "Add to Cart Buttons",
  "ai-assistant": "AI Assistant",
  "header-nav": "Header Navigation",
  "bottom-nav": "Mobile Bottom Nav",
  footer: "Footer",
  banners: "Banners",
  stories: "Stories",
  cta: "CTA Buttons",
};

/** Reserved key for page-level rollups (scroll depth, time on page). */
export const PAGE_SECTION = "__page";

export const HEAT_SECTION_KEYS = Object.keys(HEAT_SECTIONS);

export function heatSectionLabel(key: string): string {
  return HEAT_SECTIONS[key] ?? key;
}

/** Group a pathname into a stable page bucket for aggregation. */
export function pageGroup(path: string): string {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/products")) return "product";
  if (path.startsWith("/categories")) return "category";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/assistant")) return "assistant";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/account")) return "account";
  return "other";
}

export const PAGE_GROUP_LABELS: Record<string, string> = {
  home: "Homepage",
  product: "Product Pages",
  category: "Category Pages",
  search: "Search",
  cart: "Cart",
  checkout: "Checkout",
  assistant: "AI Assistant",
  blog: "Blog",
  account: "Account",
  other: "Other Pages",
};
