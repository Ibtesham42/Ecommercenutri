/**
 * Client-safe single-source-of-truth catalog for the JNV Smart Class module —
 * both the admin manager and the public student portal read the same class
 * levels, default subjects, and file-kind detection so they never drift.
 */

export const JNV_CLASS_LEVELS = [6, 7, 8, 9, 10] as const;
export type JnvClassLevel = (typeof JNV_CLASS_LEVELS)[number];

export function isJnvClassLevel(value: unknown): value is JnvClassLevel {
  return typeof value === "number" && (JNV_CLASS_LEVELS as readonly number[]).includes(value);
}

export function jnvClassLabel(level: number): string {
  return `Class ${level}`;
}

/** Suggested subject folders offered when an admin creates a class's first folders. */
export const JNV_DEFAULT_SUBJECTS = [
  "Computer",
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "SST",
  "Practical",
  "Projects",
] as const;

export const JNV_FILE_KINDS = [
  "PDF",
  "PPT",
  "DOC",
  "XLS",
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "ZIP",
  "OTHER",
] as const;
export type JnvFileKind = (typeof JNV_FILE_KINDS)[number];

export const JNV_FILE_KIND_LABELS: Record<JnvFileKind, string> = {
  PDF: "PDF",
  PPT: "Slides",
  DOC: "Document",
  XLS: "Spreadsheet",
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO: "Video",
  ZIP: "Archive",
  OTHER: "File",
};

const EXT_TO_KIND: Record<string, JnvFileKind> = {
  pdf: "PDF",
  ppt: "PPT",
  pptx: "PPT",
  doc: "DOC",
  docx: "DOC",
  xls: "XLS",
  xlsx: "XLS",
  csv: "XLS",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  png: "IMAGE",
  webp: "IMAGE",
  gif: "IMAGE",
  svg: "IMAGE",
  mp3: "AUDIO",
  wav: "AUDIO",
  m4a: "AUDIO",
  ogg: "AUDIO",
  mp4: "VIDEO",
  webm: "VIDEO",
  mov: "VIDEO",
  m4v: "VIDEO",
  zip: "ZIP",
  rar: "ZIP",
  "7z": "ZIP",
};

/** Extensions accepted by the upload picker (kept in sync with EXT_TO_KIND). */
export const JNV_ACCEPT = Object.keys(EXT_TO_KIND)
  .map((ext) => `.${ext}`)
  .join(",");

/** Detect a resource's file kind from its name/URL, falling back to MIME type. */
export function detectJnvFileKind(filenameOrUrl: string, mimeType?: string | null): JnvFileKind {
  const clean = filenameOrUrl.split(/[?#]/)[0];
  const ext = (clean.split(".").pop() ?? "").toLowerCase();
  if (EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];
  if (mimeType) {
    if (mimeType.startsWith("image/")) return "IMAGE";
    if (mimeType.startsWith("video/")) return "VIDEO";
    if (mimeType.startsWith("audio/")) return "AUDIO";
    if (mimeType === "application/pdf") return "PDF";
    if (mimeType.includes("zip") || mimeType.includes("compressed")) return "ZIP";
  }
  return "OTHER";
}

const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9 ._-]/g;

/** Strip path separators and unsafe characters from a user-supplied filename. */
export function sanitizeJnvFilename(name: string): string {
  return name.replace(/[/\\]/g, "-").replace(UNSAFE_FILENAME_CHARS, "").trim().slice(0, 200);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${i === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
