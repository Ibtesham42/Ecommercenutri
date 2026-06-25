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

export async function deleteImage(publicId: string): Promise<void> {
  if (!cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    /* ignore */
  }
}
