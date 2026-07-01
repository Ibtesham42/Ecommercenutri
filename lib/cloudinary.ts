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
