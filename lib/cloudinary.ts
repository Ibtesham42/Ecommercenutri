import { v2 as cloudinary } from "cloudinary";
import { env, isConfigured } from "@/lib/env";

export const cloudinaryEnabled = isConfigured.cloudinary();

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

export { cloudinary };

/**
 * Upload an image (data URI, base64, or remote URL) and return its secure URL.
 * Without Cloudinary configured, the input is assumed to already be a usable
 * URL and returned as-is.
 */
export async function uploadImage(
  file: string,
  folder = "nutriyet",
): Promise<string> {
  if (!cloudinaryEnabled) return file;
  const result = await cloudinary.uploader.upload(file, {
    folder,
    resource_type: "auto",
  });
  return result.secure_url;
}

/** Keep folders to a safe, predictable set under the nutriyet namespace. */
export function safeFolder(folder?: string | null): string {
  const cleaned = (folder ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");
  return cleaned ? `nutriyet/${cleaned}` : "nutriyet";
}

export type SignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

/**
 * Build a signed payload for a direct browser→Cloudinary upload. The file bytes
 * go straight from the client to Cloudinary and never pass through our serverless
 * function, so large media (hero/banner videos) isn't capped by Vercel's ~4.5 MB
 * request-body limit or the function execution timeout. The signature covers only
 * the folder + timestamp; the endpoint that calls this is admin-gated.
 */
export function signUpload(folder: string): SignedUpload | null {
  if (!cloudinaryEnabled) return null;
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    env.cloudinaryApiSecret,
  );
  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    signature,
    folder,
  };
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    /* ignore */
  }
}

/**
 * Extract the public_id from any of OUR Cloudinary delivery URLs (raw upload
 * URLs and transformed ones like `/upload/so_0,f_jpg/v123/nutriyet/hero/x.jpg`).
 * Returns null for non-Cloudinary URLs, other clouds, or anything outside the
 * `nutriyet/` namespace — so callers can never destroy an asset we don't own.
 */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !cloudinaryEnabled) return null;
  if (!url.includes(`res.cloudinary.com/${env.cloudinaryCloudName}/`)) return null;
  const m = url.match(/\/upload\/(.+)$/);
  if (!m) return null;
  const segments = m[1].split("/");
  // Drop transformation segments (contain "_" params separated by commas, e.g.
  // "so_0,f_jpg,q_auto") and the version segment ("v1234567890").
  while (segments.length > 1 && (/^v\d+$/.test(segments[0]) || /(^|,)[a-z]{1,4}_[^/]*$/.test(segments[0]))) {
    segments.shift();
  }
  const publicId = segments.join("/").replace(/\.[a-z0-9]+(\?.*)?$/i, "");
  return publicId.startsWith("nutriyet/") ? publicId : null;
}

/**
 * Completely remove an uploaded asset by its delivery URL: the original file,
 * every derived/transformed version, and (via `invalidate`) the CDN-cached
 * copies. Tries the matching resource type first, then the other, so a video
 * poster URL (image transform of a video public_id) still resolves. Best-effort:
 * never throws (the DB record is the source of truth; an orphan is logged).
 * Returns true when Cloudinary confirmed the deletion.
 */
export async function destroyAssetByUrl(url: string | null | undefined): Promise<boolean> {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return false;
  const looksVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url!);
  const order: ("video" | "image")[] = looksVideo ? ["video", "image"] : ["image", "video"];
  for (const resourceType of order) {
    try {
      const res = (await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      })) as { result?: string };
      if (res?.result === "ok") return true;
      // "not found" → try the other resource type.
    } catch (err) {
      console.error(`[cloudinary] destroy ${resourceType}/${publicId} failed:`, err);
    }
  }
  console.warn(`[cloudinary] asset not removed (may be orphaned): ${publicId}`);
  return false;
}
