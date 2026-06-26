/**
 * Promotional banner placements. Each `key` is a spot on the storefront where
 * `BannerStrip` renders the active banners for that position (by priority).
 * Adding a new placement = add a key here + drop a <BannerStrip position> in.
 */
export const BANNER_POSITIONS = [
  { key: "homeTop", label: "Homepage — top" },
  { key: "productsTop", label: "Products page — top" },
  { key: "categoryTop", label: "Category page — top" },
] as const;

export type BannerPosition = (typeof BANNER_POSITIONS)[number]["key"];

export const BANNER_POSITION_KEYS: BannerPosition[] = BANNER_POSITIONS.map((p) => p.key);

export const BANNER_POSITION_LABELS: Record<BannerPosition, string> = Object.fromEntries(
  BANNER_POSITIONS.map((p) => [p.key, p.label]),
) as Record<BannerPosition, string>;

export function isBannerPosition(value: string): value is BannerPosition {
  return (BANNER_POSITION_KEYS as string[]).includes(value);
}
