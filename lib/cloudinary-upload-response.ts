import { MB } from "@/lib/upload-rules";

/**
 * Interpret Cloudinary's response to a direct browser upload. Kept in a plain
 * module (not the "use client" uploader) so it's unit-testable.
 *
 * Cloudinary's JSON error text is translated into an admin-friendly sentence
 * where we recognise it (size cap, format, stale signature, rate limit…);
 * anything else is shown as Cloudinary's own message — it never contains
 * secrets. `retryable` marks transient failures (5xx, rate limit, no
 * response) that the uploader may retry automatically.
 */
export type CloudinaryUploadResult<T> =
  | { ok: true; info: T & { secure_url: string } }
  | { ok: false; error: string; retryable: boolean };

export const CLOUDINARY_SUPPORT_MESSAGE =
  "Cloudinary upload failed. Please contact support if the problem continues.";

export function friendlyCloudinaryError(status: number, message: string | undefined): { error: string; retryable: boolean } {
  const msg = (message ?? "").trim();

  const size = /file size too large.*?maximum is (\d+)/i.exec(msg);
  if (size) {
    const limitMb = Math.round(Number(size[1]) / MB);
    const isVideo = /video/i.test(msg) || limitMb >= 50;
    return { error: `${isVideo ? "Video" : "File"} size exceeds the ${limitMb} MB limit.`, retryable: false };
  }
  if (/file size too large/i.test(msg)) return { error: "File size exceeds the upload limit.", retryable: false };
  if (/total pixels|resolution|megapixel/i.test(msg)) {
    return { error: "Image resolution is too large (max 25 megapixels). Please resize it and retry.", retryable: false };
  }
  if (/format .*not allowed|not allowed.*format|invalid image file|invalid video file|unsupported|unknown file format/i.test(msg)) {
    return { error: "Unsupported file format. Please upload a supported image or video.", retryable: false };
  }
  if (/stale request/i.test(msg)) {
    return { error: "The upload took too long and expired. Please try again.", retryable: false };
  }
  if (/invalid signature|api_key|api key|account.*disabled|cloud_name/i.test(msg)) {
    return { error: CLOUDINARY_SUPPORT_MESSAGE, retryable: false };
  }
  if (status === 420 || status === 429 || /rate limit|too many/i.test(msg)) {
    return { error: "Cloudinary is busy right now. Please wait a minute and retry.", retryable: true };
  }
  if (status === 0) {
    return { error: "Network connection lost. Please check your internet and retry.", retryable: true };
  }
  if (status >= 500) return { error: CLOUDINARY_SUPPORT_MESSAGE, retryable: true };
  if (msg) return { error: `Upload failed: ${msg}`, retryable: false };
  return { error: `Cloudinary upload failed (HTTP ${status}). Please try again.`, retryable: false };
}

export function parseCloudinaryUploadResponse<T extends { secure_url?: string }>(
  status: number,
  responseText: string,
): CloudinaryUploadResult<T> {
  let body: (T & { error?: { message?: string } }) | null = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    /* non-JSON body (proxy/gateway page) */
  }
  if (status >= 200 && status < 300 && body?.secure_url) {
    return { ok: true, info: body as T & { secure_url: string } };
  }
  if (status >= 200 && status < 300) {
    return { ok: false, error: "Cloudinary didn't return the uploaded file. Please try again.", retryable: true };
  }
  return { ok: false, ...friendlyCloudinaryError(status, body?.error?.message) };
}
