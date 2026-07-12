import "server-only";
import { cloudinary, cloudinaryEnabled, publicIdFromUrl } from "@/lib/cloudinary";
import { derivePalette, BRAND_PALETTE, type Palette } from "@/lib/social/design";

/**
 * Dominant colours of a product photo, via Cloudinary's colour analysis, folded
 * into a harmonious post palette (lib/social/design.ts#derivePalette).
 *
 * Cached per public_id for the life of the lambda: the planner designs at most a
 * couple of posts per run and the admin previews the same product repeatedly, so
 * this keeps us well clear of the Admin API rate limit.
 *
 * Never throws and never blocks a post: a keyless install, a non-Cloudinary URL
 * or an API failure all fall back to the brand palette, which is what the posts
 * used before any of this existed.
 */

const cache = new Map<string, Palette>();

type ColorsResource = { colors?: [string, number][] };

export async function paletteForImage(imageUrl: string | null | undefined): Promise<Palette> {
  if (!imageUrl || !cloudinaryEnabled) return BRAND_PALETTE;

  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) return BRAND_PALETTE; // pasted/external image — no analysis

  const hit = cache.get(publicId);
  if (hit) return hit;

  try {
    const res = (await cloudinary.api.resource(publicId, {
      colors: true,
    })) as ColorsResource;
    const colors = Array.isArray(res.colors) ? res.colors.slice(0, 8) : [];
    const palette = colors.length ? derivePalette(colors) : BRAND_PALETTE;
    cache.set(publicId, palette);
    return palette;
  } catch (err) {
    console.error(`[social] colour analysis failed for ${publicId}:`, err);
    return BRAND_PALETTE;
  }
}
