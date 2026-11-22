import { IMAGE_STORED_MAX_MB, MB, VIDEO_MAX_MB } from "@/lib/upload-rules";

/**
 * Marketing-kit upload rules — client-safe single source of truth shared by the
 * admin file picker (pre-flight check), the signing endpoint (signs only these
 * formats, so Cloudinary itself rejects anything else) and the post-upload
 * verification (re-checks the real stored bytes + format server-side).
 */

export const MARKETING_UPLOAD_FOLDER = "nutriyet/marketing";

/**
 * Per-file caps, matched to the Cloudinary plan (`lib/upload-rules.ts`): kit
 * files are stored as-is (affiliates download the originals), so images and
 * PDFs are bound by Cloudinary's 10 MB image cap and videos by its 100 MB cap.
 * Bytes go browser → Cloudinary directly, never through Vercel.
 */
export const MARKETING_UPLOAD_MAX_BYTES = VIDEO_MAX_MB * MB;
const MARKETING_VIDEO_FORMATS = ["mp4", "mov", "webm"];

/** Cap for one file, by Cloudinary format / extension. */
export function marketingMaxBytes(formatOrExt: string): number {
  return MARKETING_VIDEO_FORMATS.includes(formatOrExt.toLowerCase()) ? VIDEO_MAX_MB * MB : IMAGE_STORED_MAX_MB * MB;
}

export function marketingTooLargeMessage(formatOrExt: string): string {
  const video = MARKETING_VIDEO_FORMATS.includes(formatOrExt.toLowerCase());
  return `${video ? "Video" : "File"} size exceeds the ${Math.round(marketingMaxBytes(formatOrExt) / MB)} MB limit.`;
}

export const MARKETING_UPLOAD_HINT = `JPG, PNG, WebP, GIF or PDF up to ${IMAGE_STORED_MAX_MB} MB · MP4, MOV or WebM up to ${VIDEO_MAX_MB} MB`;

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
  if (file.size > marketingMaxBytes(ext)) return marketingTooLargeMessage(ext);
  return null;
}
