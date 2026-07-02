/**
 * Cloudinary delivery helper. Injects automatic format + quality (and optional
 * resize) transforms into a Cloudinary URL so images are optimized on delivery.
 * Non-Cloudinary URLs (e.g. placehold.co, pasted URLs) are returned unchanged,
 * so this is always safe to call.
 */
export function cldUrl(
  url: string | null | undefined,
  opts: {
    w?: number;
    h?: number;
    crop?: "fill" | "fit";
    /** Focal point for cropping. "auto" = Cloudinary smart content detection. */
    gravity?: "auto" | "center" | "face";
    /** Device pixel ratio. "auto" serves a sharper image on retina screens. */
    dpr?: "auto" | number;
  } = {},
): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  const t = ["f_auto", "q_auto"];
  if (opts.dpr) t.push(`dpr_${opts.dpr}`);
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  if (opts.w || opts.h) {
    t.push(`c_${opts.crop ?? "fill"}`);
    if (opts.gravity) t.push(`g_${opts.gravity}`);
  }

  return url.replace("/upload/", `/upload/${t.join(",")}/`);
}

/**
 * Deliver any Cloudinary asset — including a PDF or SVG — as a sized raster PNG.
 * Used where an external service requires a real bitmap image (e.g. the Razorpay
 * checkout logo, which can't render a PDF/SVG). Non-Cloudinary URLs are returned
 * unchanged (they must already be a usable image).
 */
export function cldRasterLogo(url: string | null | undefined, size = 256): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url
    .replace("/upload/", `/upload/f_png,pg_1,c_fit,w_${size},h_${size}/`)
    .replace(/\.(pdf|svg|webp|avif|jpe?g|gif|tiff?)(\?|$)/i, ".png$2");
}

/**
 * Normalize any uploaded product image for the 3D showcase so every item looks
 * consistent regardless of source dimensions/format. Cloudinary auto-trims solid
 * (e.g. white) borders (`e_trim`), then fits/pads the product into a centered
 * square — never cropping or stretching it. `transparent` pads with alpha (for
 * cut-out PNGs that float on the stage); otherwise it fits within the square so a
 * white/colored background blends into the product card. No-op for non-Cloudinary
 * URLs (returned unchanged), so pasted external URLs still work.
 */
export function cldShowcaseImage(
  url: string | null | undefined,
  opts: { transparent?: boolean; size?: number } = {},
): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const size = opts.size ?? 900;
  const t = opts.transparent
    ? // Trim → center-pad to a transparent square (consistent framing, blends).
      `e_trim:12,c_pad,w_${size},h_${size},b_transparent,f_auto,q_auto`
    : // Trim → fit within a square (product fills the card consistently).
      `e_trim:12,c_fit,w_${size},h_${size},f_auto,q_auto`;
  return url.replace("/upload/", `/upload/${t}/`);
}

/**
 * Deliver an uploaded favicon as a Google-friendly icon: a real PNG (not f_auto,
 * which can serve WebP/AVIF that Google's favicon crawler ignores), squared to a
 * multiple-of-48 size (Google's requirement), padding rather than cropping so the
 * whole mark is kept. No-op for non-Cloudinary URLs (returned unchanged).
 */
export function cldFavicon(url: string | null | undefined, size = 96): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url
    .replace("/upload/", `/upload/f_png,q_auto,w_${size},h_${size},c_pad,b_transparent/`)
    .replace(/\.(svg|webp|avif|jpe?g|gif|tiff?)(\?|$)/i, ".png$2");
}

/** True for URLs we should treat as video in previews/viewers. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

// NOTE: video delivery moved to `lib/video.ts` (`cldVideoVariant` — adaptive,
// profile-driven, never upscales). `cldVideoPoster` below remains for legacy
// list thumbnails; richer frame/poster helpers live in `lib/video.ts` too.

/**
 * Poster image (first frame) for a Cloudinary video URL — used as the banner's
 * fallback image (list thumbnail, smooth load before the video plays). No-op for
 * non-Cloudinary URLs.
 */
export function cldVideoPoster(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url
    .replace("/upload/", "/upload/so_0,f_jpg,q_auto/")
    .replace(/\.(mp4|webm|mov|m4v)(\?|$)/i, ".jpg$2");
}
