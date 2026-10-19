/**
 * Marketing-kit upload rules — client-safe single source of truth shared by the
 * admin file picker (pre-flight check), the signing endpoint (signs only these
 * formats, so Cloudinary itself rejects anything else) and the post-upload
 * verification (re-checks the real stored bytes + format server-side).
 */

export const MARKETING_UPLOAD_FOLDER = "nutriyet/marketing";

/** Per-file cap. Bytes go browser → Cloudinary directly, never through Vercel. */
export const MARKETING_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Cloudinary `format` values we accept (images, short videos, PDFs). */
export const MARKETING_UPLOAD_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm", "pdf"] as const;

const MIME_OK = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf)$/;

export const MARKETING_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf";

/** Human-readable reason a file can't be uploaded, or null when it's fine. */
export function checkMarketingFile(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME_OK.test(file.type) || !(MARKETING_UPLOAD_FORMATS as readonly string[]).includes(ext)) {
    return "Use a JPG, PNG, WebP or GIF image, an MP4, MOV or WebM video, or a PDF.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "That file is empty.";
  if (file.size > MARKETING_UPLOAD_MAX_BYTES) {
    return `File is too large (max ${Math.round(MARKETING_UPLOAD_MAX_BYTES / 1024 / 1024)} MB).`;
  }
  return null;
}
