/**
 * Hero/banner video delivery core — the single place that decides how uploaded
 * videos are transformed, sized and streamed to visitors. Client-safe (pure
 * URL/string math, no server imports).
 *
 * Design principles (in priority order):
 *  1. Visual quality — never upscale (c_limit only), never server-crop (CSS
 *     object-cover frames the video), H.264 MP4 first (predictable quality
 *     everywhere; Cloudinary's WebM auto-quality is noticeably softer).
 *  2. Adaptive delivery — 1080/720/480 rungs picked from viewport + network
 *     (`pickVariantHeight`), so phones never download the desktop file.
 *  3. Admin-controlled quality profile — "max" | "balanced" | "eco" maps to
 *     Cloudinary `q_auto:best|good|eco` without exposing codec knobs.
 *
 * Future-ready seams (add here, callers stay unchanged):
 *  - HLS/DASH: add `cldVideoStream(url, profile)` returning an `.m3u8`/`.mpd`
 *    (Cloudinary `sp_` streaming profiles) and let `BannerVideo` prefer it.
 *  - Watermarking: add an `l_` overlay step to `transformFor`.
 *  - Analytics/engagement: `BannerVideo` exposes a single `<video>` element —
 *    attach listeners there.
 */

export type VideoQualityProfile = "max" | "balanced" | "eco";

export const VIDEO_QUALITY_PROFILES: {
  value: VideoQualityProfile;
  label: string;
  hint: string;
}[] = [
  { value: "max", label: "Maximum quality", hint: "Sharpest picture, larger files. For brand-critical hero videos." },
  { value: "balanced", label: "Balanced (recommended)", hint: "Visually lossless for most content, sensible file size." },
  { value: "eco", label: "Performance", hint: "Smallest files, fastest start. Fine for ambient/background motion." },
];

/** Cloudinary q_auto level per profile. */
const Q: Record<VideoQualityProfile, string> = {
  max: "q_auto:best",
  balanced: "q_auto:good",
  eco: "q_auto:eco",
};

export function normalizeQuality(v: string | null | undefined): VideoQualityProfile {
  return v === "max" || v === "eco" ? v : "balanced";
}

/** Adaptive ladder (video height in px). Desktop → tablet → phone/slow. */
export const VIDEO_VARIANT_HEIGHTS = [1080, 720, 480] as const;
export type VariantHeight = (typeof VIDEO_VARIANT_HEIGHTS)[number];

const isCld = (url: string) => url.includes("res.cloudinary.com") && url.includes("/upload/");

function inject(url: string, transform: string): string {
  return url.replace("/upload/", `/upload/${transform}/`);
}

/**
 * One delivery rung: H.264 MP4 (or WebM), profile-driven quality, scaled DOWN
 * to at most `h` pixels tall (`c_limit` keeps aspect ratio, never upscales,
 * never crops — the visitor's CSS `object-cover` does the framing). No-op for
 * non-Cloudinary URLs so pasted links still play.
 */
export function cldVideoVariant(
  url: string | null | undefined,
  opts: { h?: number; quality?: VideoQualityProfile; fmt?: "mp4" | "webm" } = {},
): string {
  if (!url) return "";
  if (!isCld(url)) return url;
  const fmt = opts.fmt ?? "mp4";
  const t = [`f_${fmt}`, Q[opts.quality ?? "balanced"], "vc_auto"];
  if (opts.h) t.push(`h_${opts.h}`, "c_limit");
  return inject(url, t.join(",")).replace(/\.(mp4|webm|mov|m4v)(\?|$)/i, `.${fmt}$2`);
}

/**
 * Pick the delivery rung for this visitor: viewport size first, then step down
 * for slow/metered connections (Save-Data or 2g/3g). Runs client-side only —
 * callers should fall back to 720 during SSR.
 */
export function pickVariantHeight(): VariantHeight {
  if (typeof window === "undefined") return 720;
  const w = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  let h: VariantHeight = w >= 1600 ? 1080 : w >= 900 ? 720 : 480;
  type NetInfo = { saveData?: boolean; effectiveType?: string };
  const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (conn?.saveData || /(^|\b)(slow-2g|2g|3g)\b/.test(conn?.effectiveType ?? "")) {
    h = h === 1080 ? 720 : 480;
  }
  return h;
}

/**
 * Poster frame from a video at a moment (`at` seconds, or a percentage like
 * "50p"). Sharp (profile-quality JPEG), correct aspect (c_limit, no crop/upscale).
 */
export function cldVideoFrame(
  url: string | null | undefined,
  opts: { at?: number | `${number}p`; h?: number; quality?: VideoQualityProfile } = {},
): string {
  if (!url) return "";
  if (!isCld(url)) return url;
  const t = [`so_${opts.at ?? 0}`, "f_jpg", Q[opts.quality ?? "max"]];
  if (opts.h) t.push(`h_${opts.h}`, "c_limit");
  return inject(url, t.join(",")).replace(/\.(mp4|webm|mov|m4v)(\?|$)/i, ".jpg$2");
}

/** Candidate poster thumbnails spread across the video (admin picker). */
export function videoThumbCandidates(url: string, count = 4): { at: `${number}p`; url: string }[] {
  const out: { at: `${number}p`; url: string }[] = [];
  for (let i = 0; i < count; i++) {
    // 0%, 25%, 50%, 75% of the duration (avoid the very end — often a fade-out).
    const p = Math.round((i * 100) / count) as number;
    const at = `${p}p` as `${number}p`;
    out.push({ at, url: cldVideoFrame(url, { at, h: 360, quality: "balanced" }) });
  }
  return out;
}

/** Resolve a slide's poster: admin choice first, else the auto first frame. */
export function resolvePoster(
  videoUrl: string | null | undefined,
  chosen: string | null | undefined,
  quality: VideoQualityProfile = "max",
): string {
  if (chosen) return chosen;
  return cldVideoFrame(videoUrl, { h: 1080, quality });
}

// --- Upload metadata ----------------------------------------------------------

/** Everything worth showing the admin about an uploaded video. */
export type VideoMeta = {
  width?: number;
  height?: number;
  /** Seconds. */
  duration?: number;
  /** Bytes. */
  bytes?: number;
  /** Container format, e.g. "mp4". */
  format?: string;
  /** Video codec, e.g. "h264". */
  codec?: string;
  /** Frames per second. */
  fps?: number;
  /** Bits per second (whole file). */
  bitrate?: number;
  /** ISO timestamp of the upload. */
  uploadedAt?: string;
};

/** Shape of the fields we read off Cloudinary's direct-upload response. */
export type CloudinaryUploadInfo = {
  secure_url?: string;
  resource_type?: string;
  width?: number;
  height?: number;
  duration?: number;
  bytes?: number;
  format?: string;
  frame_rate?: number;
  bit_rate?: number;
  video?: { codec?: string };
  created_at?: string;
};

/** Fold a Cloudinary upload response into our stored `VideoMeta`. */
export function parseVideoMeta(info: CloudinaryUploadInfo): VideoMeta {
  return {
    width: info.width,
    height: info.height,
    duration: info.duration,
    bytes: info.bytes,
    format: info.format,
    codec: info.video?.codec,
    fps: info.frame_rate,
    bitrate: info.bit_rate,
    uploadedAt: info.created_at ?? new Date().toISOString(),
  };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Human helpers for the admin metadata card. */
export function formatVideoMeta(m: VideoMeta | null | undefined) {
  if (!m) return null;
  const aspect =
    m.width && m.height
      ? (() => {
          const g = gcd(m.width!, m.height!);
          const a = m.width! / g;
          const b = m.height! / g;
          return a <= 100 ? `${a}:${b}` : (m.width! / m.height!).toFixed(2) + ":1";
        })()
      : null;
  return {
    resolution: m.width && m.height ? `${m.width}×${m.height}` : null,
    aspect,
    duration: m.duration ? `${m.duration.toFixed(1)}s` : null,
    size: m.bytes ? (m.bytes >= 1048576 ? `${(m.bytes / 1048576).toFixed(1)} MB` : `${Math.round(m.bytes / 1024)} KB`) : null,
    codec: m.codec ? m.codec.toUpperCase() : null,
    fps: m.fps ? `${Math.round(m.fps)} fps` : null,
    bitrate: m.bitrate ? `${(m.bitrate / 1_000_000).toFixed(1)} Mbps` : null,
    uploaded: m.uploadedAt ?? null,
  };
}
