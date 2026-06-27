/**
 * Registry of homepage sections that admins can show/hide and reorder
 * (Homepage Section Builder). The order here is the default layout — identical
 * to the current homepage — used until an admin customizes it. Each `key` maps
 * to a rendered section in `app/(storefront)/page.tsx`.
 */
export const HOME_SECTIONS = [
  { key: "stories", label: "Stories", note: "Instagram-style story rail" },
  { key: "heroSlider", label: "Hero Slider", note: "Slides from Hero Slider manager" },
  { key: "hero", label: "Hero Banner", note: "Headline, CTA and stats" },
  { key: "categories", label: "Categories", note: "Shop by category grid" },
  { key: "featured", label: "Featured Products" },
  { key: "bestSellers", label: "Best Sellers" },
  { key: "recommended", label: "Recommended", note: "Personalized, logged-in only" },
  { key: "trending", label: "Trending Now", note: "Behavioral — views, orders, wishlist" },
  { key: "combos", label: "Shop by Goal", note: "AI product combos (breakfast, weight loss…)" },
  { key: "whyChooseUs", label: "Why Choose Us" },
  { key: "testimonials", label: "Testimonials" },
  { key: "aiBanner", label: "AI Assistant Banner" },
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number]["key"];

export const HOME_SECTION_KEYS: HomeSectionKey[] = HOME_SECTIONS.map((s) => s.key);

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, s.label]),
) as Record<HomeSectionKey, string>;

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return (HOME_SECTION_KEYS as string[]).includes(value);
}
