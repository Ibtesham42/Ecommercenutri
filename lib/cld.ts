/**
 * Cloudinary delivery helper. Injects automatic format + quality (and optional
 * resize) transforms into a Cloudinary URL so images are optimized on delivery.
 * Non-Cloudinary URLs (e.g. placehold.co, pasted URLs) are returned unchanged,
 * so this is always safe to call.
 */
export function cldUrl(
  url: string | null | undefined,
  opts: { w?: number; h?: number; crop?: "fill" | "fit" } = {},
): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  const t = ["f_auto", "q_auto"];
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  if (opts.w || opts.h) t.push(`c_${opts.crop ?? "fill"}`);

  return url.replace("/upload/", `/upload/${t.join(",")}/`);
}

/** True for URLs we should treat as video in previews/viewers. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
