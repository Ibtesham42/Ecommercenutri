import { detectJnvFileKind } from "@/lib/jnv/catalog";

/**
 * Size caps for JNV admin uploads, in MB. Cloudinary enforces its own per-plan,
 * per-resource-type maximums (video/audio go to the `video` type; PDFs and
 * images to `image`; Office/zip files to `raw`), which usually differ — so the
 * picker has two configurable caps instead of one hard-coded number. Set them to
 * match the account's plan so an oversized file is refused up front with a clear
 * message instead of failing after the upload starts.
 *
 *   JNV_MAX_MEDIA_UPLOAD_MB     video/audio (default 100 — the previous fixed cap)
 *   JNV_MAX_DOCUMENT_UPLOAD_MB  everything else (defaults to the media cap)
 */
export type JnvUploadLimits = { mediaMb: number; documentMb: number };

const DEFAULT_MEDIA_MB = 100;

function parseMb(raw: string | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve limits from env (server-side; pass the result to the client as a prop). */
export function resolveJnvUploadLimits(source: Record<string, string | undefined> = process.env): JnvUploadLimits {
  const mediaMb = parseMb(source.JNV_MAX_MEDIA_UPLOAD_MB) ?? DEFAULT_MEDIA_MB;
  const documentMb = parseMb(source.JNV_MAX_DOCUMENT_UPLOAD_MB) ?? mediaMb;
  return { mediaMb, documentMb };
}

/** Null when the file is within its cap, else a message for the admin. */
export function jnvUploadSizeError(
  file: { name: string; type: string; size: number },
  limits: JnvUploadLimits,
): string | null {
  const kind = detectJnvFileKind(file.name, file.type);
  const isMedia = kind === "VIDEO" || kind === "AUDIO";
  const maxMb = isMedia ? limits.mediaMb : limits.documentMb;
  if (file.size <= maxMb * 1024 * 1024) return null;
  return `That file is too large (max ${maxMb} MB for ${isMedia ? "video/audio" : "documents and images"}).`;
}
