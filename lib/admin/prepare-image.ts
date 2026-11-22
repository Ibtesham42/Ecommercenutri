import { IMAGE_STORED_MAX_MB, MB, RECOMPRESSIBLE_TYPES } from "@/lib/upload-rules";

/**
 * Longest edge kept for admin images. 2560px covers full-width desktop
 * banners/heroes on large/retina screens (the old 1600px cap visibly softened
 * them) and stays far below Cloudinary's 25-megapixel cap.
 */
const MAX_DIM = 2560;
/** Small images that fit (logos, icons, web-ready photos) are sent untouched. */
const KEEP_SMALL_BYTES = 1.5 * MB;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Shrink a large JPG/PNG/WebP client-side (resize to MAX_DIM + recompress) so
 * a 15 MB camera original lands well under Cloudinary's 10 MB image cap.
 *
 * JPEGs re-encode as JPEG. PNG/WebP re-encode as WebP, which keeps the alpha
 * channel — they used to be converted to JPEG, turning transparent cut-outs
 * and logos black. If a browser can't encode WebP it returns PNG, which is
 * still lossless and transparent. Other types (GIF, SVG, AVIF, HEIC, ICO,
 * video) are returned untouched. Falls back to the original on any failure.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; filename: string }> {
  const original = { blob: file as Blob, filename: file.name || "upload" };
  if (!RECOMPRESSIBLE_TYPES.includes(file.type) || typeof createImageBitmap !== "function") return original;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const longest = Math.max(width, height);
    const needsResize = longest > MAX_DIM;
    if (!needsResize && file.size <= KEEP_SMALL_BYTES) return original;
    if (needsResize) {
      const scale = MAX_DIM / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const keepsAlpha = file.type !== "image/jpeg";
    const blob = await encode(canvas, keepsAlpha ? "image/webp" : "image/jpeg", keepsAlpha ? 0.9 : 0.85);
    if (!blob) return original;
    // Re-encoding didn't help and the original is uploadable as-is → keep the original.
    if (!needsResize && blob.size >= file.size) return original;
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    const base = (file.name || "upload").replace(/\.[^.]+$/, "");
    return { blob, filename: `${base}.${ext}` };
  } catch {
    return original;
  } finally {
    bitmap?.close();
  }
}

/** Error when a prepared image is still over Cloudinary's stored-image cap, else null. */
export function preparedImageTooLarge(blob: Blob): string | null {
  return blob.size > IMAGE_STORED_MAX_MB * MB
    ? `This image is still larger than ${IMAGE_STORED_MAX_MB} MB after compression. Please resize it and retry.`
    : null;
}
