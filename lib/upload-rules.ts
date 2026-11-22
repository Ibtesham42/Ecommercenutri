/**
 * Admin media-upload rules — client-safe single source of truth shared by the
 * upload fields (pre-flight checks + the requirement hints they show), the
 * signing endpoint (`/api/admin/upload-signature` signs `allowed_formats` from
 * here, so Cloudinary itself rejects other types by inspecting the bytes) and
 * the error mapping for Cloudinary's responses.
 *
 * Limits are tied to the Cloudinary plan (Free, checked 2026-11-22 via the
 * Admin API `usage` endpoint): 10 MB per stored image, 100 MB per video,
 * 25 megapixels per image. Cloudinary enforces those server-side regardless of
 * what the browser does. JPG/PNG/WebP up to IMAGE_SOURCE_MAX_MB are accepted
 * because they're downscaled + recompressed in the browser before upload
 * (`lib/admin/prepare-image.ts`), which lands them far below the stored cap.
 * If the plan is upgraded, raise IMAGE_STORED_MAX_MB / VIDEO_MAX_MB here.
 */

export const MB = 1024 * 1024;

/** Largest JPG/PNG/WebP an admin may pick (it's recompressed before upload). */
export const IMAGE_SOURCE_MAX_MB = 15;
/** Cloudinary's per-image cap — applies to images sent as-is (GIF, SVG, AVIF, HEIC, ICO). */
export const IMAGE_STORED_MAX_MB = 10;
/** Cloudinary's per-video cap. */
export const VIDEO_MAX_MB = 100;
/** Cloudinary's per-image resolution cap. */
export const IMAGE_MAX_MEGAPIXELS = 25;

/** What an upload field accepts. `media` = an image OR a video (stories). */
export type MediaKind = "image" | "video" | "media";

export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "ico", "heic", "heif"] as const;
export const VIDEO_FORMATS = ["mp4", "webm", "mov"] as const;

/** Formats re-encoded in the browser (resize + recompress) before upload. */
export const RECOMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const IMAGE_MIME = /^image\/(jpeg|pjpeg|png|webp|gif|avif|svg\+xml|x-icon|vnd\.microsoft\.icon|heic|heif)$/;
const VIDEO_MIME = /^video\/(mp4|webm|quicktime)$/;

export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

const IMAGE_FORMAT_LABEL = "JPG, PNG, WebP, GIF, AVIF or SVG";
const VIDEO_FORMAT_LABEL = "MP4, WebM or MOV";

/** The Cloudinary `allowed_formats` list to sign for a kind. */
export function allowedFormatsFor(kind: MediaKind): string {
  if (kind === "image") return IMAGE_FORMATS.join(",");
  if (kind === "video") return VIDEO_FORMATS.join(",");
  return [...IMAGE_FORMATS, ...VIDEO_FORMATS].join(",");
}

export function isMediaKind(value: unknown): value is MediaKind {
  return value === "image" || value === "video" || value === "media";
}

/** Infer the kind from an `<input accept>` string (keeps existing call sites working). */
export function kindFromAccept(accept: string | undefined): MediaKind {
  const a = (accept ?? "").toLowerCase();
  const video = a.includes("video");
  const image = a === "" || a.includes("image") || /\.(jpe?g|png|webp|gif|svg|ico)/.test(a);
  if (video && image) return "media";
  return video ? "video" : "image";
}

/** The `<input accept>` to use for a kind. */
export function acceptFor(kind: MediaKind): string {
  if (kind === "image") return IMAGE_ACCEPT;
  if (kind === "video") return VIDEO_ACCEPT;
  return `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

type FileLike = { name: string; type: string; size: number };

/** True when the file is a video (by MIME, or by extension when the OS gives no MIME). */
export function isVideoFile(file: Pick<FileLike, "name" | "type">): boolean {
  if (file.type) return file.type.startsWith("video/");
  return (VIDEO_FORMATS as readonly string[]).includes(extOf(file.name));
}

/**
 * Human-readable reason a picked file can't be uploaded, or null when it's
 * fine. Both the extension AND (when the browser reports one) the MIME type
 * must be allowed — neither alone is trusted; Cloudinary re-checks the actual
 * bytes against the signed `allowed_formats`.
 */
export function checkMediaFile(file: FileLike, kind: MediaKind): string | null {
  const ext = extOf(file.name);
  const video = isVideoFile(file);

  if (video) {
    const okExt = (VIDEO_FORMATS as readonly string[]).includes(ext);
    const okMime = !file.type || VIDEO_MIME.test(file.type);
    if (kind === "image" || !okExt || !okMime) {
      return kind === "image"
        ? `Unsupported file format. Please upload ${IMAGE_FORMAT_LABEL}.`
        : `Unsupported video format. Please upload ${VIDEO_FORMAT_LABEL}.`;
    }
    if (file.size <= 0) return "That file is empty.";
    if (file.size > VIDEO_MAX_MB * MB) return `Video size exceeds the ${VIDEO_MAX_MB} MB limit.`;
    return null;
  }

  const okExt = (IMAGE_FORMATS as readonly string[]).includes(ext);
  const okMime = !file.type || IMAGE_MIME.test(file.type);
  if (kind === "video" || !okExt || !okMime) {
    return kind === "video"
      ? `Unsupported video format. Please upload ${VIDEO_FORMAT_LABEL}.`
      : `Unsupported file format. Please upload ${IMAGE_FORMAT_LABEL}${kind === "media" ? `, or an ${VIDEO_FORMAT_LABEL} video` : ""}.`;
  }
  if (file.size <= 0) return "That file is empty.";
  const recompressible = RECOMPRESSIBLE_TYPES.includes(file.type) || ["jpg", "jpeg", "png", "webp"].includes(ext);
  const maxMb = recompressible ? IMAGE_SOURCE_MAX_MB : IMAGE_STORED_MAX_MB;
  if (file.size > maxMb * MB) return `File size exceeds the ${maxMb} MB limit.`;
  return null;
}

/** One-line requirements hint shown under an upload field. */
export function mediaRequirements(kind: MediaKind, opts: { maxDurationSec?: number } = {}): string {
  const image = `${IMAGE_FORMAT_LABEL.replace(" or ", ", ")} · max ${IMAGE_SOURCE_MAX_MB} MB`;
  const video = `${VIDEO_FORMAT_LABEL} · up to ${VIDEO_MAX_MB} MB${opts.maxDurationSec ? ` · max ${opts.maxDurationSec}s` : ""}`;
  if (kind === "image") return image;
  if (kind === "video") return video;
  return `Images: ${image}. Videos: ${video}.`;
}
