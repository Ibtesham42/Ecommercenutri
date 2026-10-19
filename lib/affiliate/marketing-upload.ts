import { cloudinary, cloudinaryEnabled, publicIdFromUrl, signUpload } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import {
  MARKETING_UPLOAD_FOLDER,
  MARKETING_UPLOAD_FORMATS,
  MARKETING_UPLOAD_MAX_BYTES,
} from "@/lib/affiliate/marketing-upload-rules";

/**
 * Signature for ONE direct browser → Cloudinary marketing-kit upload. Credentials
 * and signing stay here; the browser only gets the short-lived signature. The
 * signature pins the folder and `allowed_formats`, so a tampered client can't
 * write elsewhere or upload other file types — Cloudinary rejects them.
 */
export function signMarketingUpload() {
  return signUpload(MARKETING_UPLOAD_FOLDER, { allowed_formats: MARKETING_UPLOAD_FORMATS.join(",") });
}

/** Our marketing-kit Cloudinary upload (as opposed to a pasted external URL). */
function ourMarketingAsset(url: string): { publicId: string; resourceType: "image" | "video" } | null {
  const publicId = publicIdFromUrl(url);
  if (!publicId || !publicId.startsWith(`${MARKETING_UPLOAD_FOLDER}/`)) return null;
  const m = url.match(new RegExp(`res\\.cloudinary\\.com/${env.cloudinaryCloudName}/(image|video)/upload/`));
  return m ? { publicId, resourceType: m[1] as "image" | "video" } : null;
}

/**
 * Server-side check of what was ACTUALLY stored (size isn't enforceable in a
 * signed upload, and the client's pre-flight check can be bypassed). An
 * oversized or wrong-format upload is deleted. Pasted non-Nutriyet URLs and
 * keyless mode pass through unchanged (existing behaviour).
 * Returns an error message, or null when the asset is acceptable.
 */
export async function verifyMarketingUpload(url: string): Promise<string | null> {
  if (!cloudinaryEnabled) return null;
  const asset = ourMarketingAsset(url);
  if (!asset) return null;
  let res: { bytes?: number; format?: string };
  try {
    res = await cloudinary.api.resource(asset.publicId, { resource_type: asset.resourceType });
  } catch (err) {
    console.error("[marketing-kit] verify failed:", err);
    return "We couldn't verify that upload. Please try again.";
  }
  const okFormat = (MARKETING_UPLOAD_FORMATS as readonly string[]).includes((res.format ?? "").toLowerCase());
  const okSize = typeof res.bytes === "number" && res.bytes <= MARKETING_UPLOAD_MAX_BYTES;
  if (okFormat && okSize) return null;
  try {
    await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType, invalidate: true });
  } catch (err) {
    console.error("[marketing-kit] destroy of rejected upload failed:", err);
  }
  return okFormat
    ? `File is too large (max ${Math.round(MARKETING_UPLOAD_MAX_BYTES / 1024 / 1024)} MB).`
    : "That file type isn't allowed.";
}
