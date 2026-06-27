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

/** True for URLs we should treat as video in previews/viewers. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
