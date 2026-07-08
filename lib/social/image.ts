/**
 * Choose the best product image(s) for a social post. Product-level images
 * (`ProductImage`) are preferred — the main image is the cover — with active
 * variant images (`ProductVariant.images[]`, Cloudinary URLs) as extra carousel
 * frames. Instagram's Content Publishing API needs public URLs, which Cloudinary
 * already provides. Pure + client-safe (no DB access).
 */

export type ImageSourceProduct = {
  images: { url: string; isMain: boolean; sortOrder: number }[];
  variants: { images: string[] }[];
};

const MAX_CAROUSEL = 10; // Instagram carousel hard limit

/**
 * Ordered, de-duplicated list of image URLs for a post. `[0]` is the cover.
 * When `carousel` is false, returns just the cover (or []).
 */
export function pickPostImages(
  product: ImageSourceProduct,
  carousel = false,
): string[] {
  const ordered = [...product.images].sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (u: string | undefined | null) => {
    const url = (u ?? "").trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  for (const img of ordered) add(img.url);
  for (const v of product.variants) for (const u of v.images) add(u);

  if (!carousel) return urls.slice(0, 1);
  return urls.slice(0, MAX_CAROUSEL);
}
