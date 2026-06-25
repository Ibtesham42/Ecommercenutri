"use server";

import { requireAdmin } from "@/lib/auth";
import { uploadImage, cloudinaryEnabled } from "@/lib/cloudinary";
import type { AdminResult } from "@/lib/actions/admin/types";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw

/** Keep folders to a safe, predictable set under the nutriyet namespace. */
function safeFolder(folder?: string): string {
  const cleaned = (folder ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");
  return cleaned ? `nutriyet/${cleaned}` : "nutriyet";
}

/**
 * Upload a base64 data-URI (or remote URL) to Cloudinary via the signed server
 * SDK and return the secure delivery URL. When Cloudinary isn't configured the
 * UI falls back to a plain URL input, so this is only called when it's live.
 */
export async function uploadImageAction(
  dataUri: string,
  folder?: string,
): Promise<AdminResult<{ url: string }>> {
  await requireAdmin();

  if (!cloudinaryEnabled) {
    return { ok: false, error: "Cloudinary isn't configured — paste an image URL instead." };
  }
  if (typeof dataUri !== "string" || !/^(data:|https?:)/.test(dataUri)) {
    return { ok: false, error: "Unsupported file." };
  }
  if (dataUri.startsWith("data:")) {
    const b64 = dataUri.split(",")[1] ?? "";
    if (b64.length * 0.75 > MAX_BYTES) {
      return { ok: false, error: "File is too large (max 8 MB)." };
    }
  }

  try {
    const url = await uploadImage(dataUri, safeFolder(folder));
    return { ok: true, data: { url } };
  } catch (err) {
    console.error("[admin] uploadImageAction failed:", err);
    return { ok: false, error: "Upload failed. Please try again." };
  }
}
