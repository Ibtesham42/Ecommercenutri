import { parseCloudinaryUploadResponse } from "@/lib/cloudinary-upload-response";
import type { CloudinaryUploadInfo } from "@/lib/video";
import type { MediaKind } from "@/lib/upload-rules";
import { trackUpload } from "@/lib/admin/upload-activity";

/**
 * Browser → Cloudinary direct upload (browser-only; import from client
 * components). Bytes never pass through our serverless functions (Vercel's
 * ~4.5 MB body cap — invariant #5). Our admin-gated endpoint only issues a
 * short-lived signature that pins the folder + allowed formats.
 *
 * Reliability:
 *  - Files over CHUNK_THRESHOLD upload in CHUNK_SIZE pieces (Cloudinary's
 *    chunked protocol: X-Unique-Upload-Id + Content-Range), so a dropped
 *    connection only re-sends the current piece, not the whole video.
 *  - Transient failures (offline, 5xx, rate limit, stalled transfer) are
 *    retried automatically with backoff; when the browser is offline we wait
 *    for it to come back before retrying.
 *  - A transfer with no progress for STALL_MS is aborted and retried.
 *  - `signal` cancels cleanly (rejects with an AbortError).
 * Every failure rejects with an `UploadError` whose message is safe to show.
 */

export type UploadInfo = CloudinaryUploadInfo & { secure_url: string };

export type SignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder?: string;
  allowed_formats?: string;
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export const NETWORK_LOST_MESSAGE = "Network connection lost. Please check your internet and retry.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const GENERIC_MESSAGE = "Upload failed. Please try again.";

const CHUNK_THRESHOLD = 20 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024; // Cloudinary minimum is 5 MB (except the last piece)
const MAX_ATTEMPTS = 4;
const STALL_MS = 60_000;
/** After the bytes are sent Cloudinary may still be processing (large videos). */
const RESPONSE_TIMEOUT_MS = 5 * 60_000;

function abortError(): DOMException {
  return new DOMException("Upload cancelled.", "AbortError");
}

export function isAbortError(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

/** Shown-to-admin message for anything an upload can throw. */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadError) return err.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return NETWORK_LOST_MESSAGE;
  return GENERIC_MESSAGE;
}

/** Ask our admin endpoint for a signature, mapping auth/network failures to clear messages. */
export async function requestSignature(endpoint: string, body: unknown): Promise<SignedUpload> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new UploadError(NETWORK_LOST_MESSAGE, true);
  }
  const data = (await res.json().catch(() => null)) as (Partial<SignedUpload> & { error?: string }) | null;
  if (res.status === 401) throw new UploadError(SESSION_EXPIRED_MESSAGE);
  if (res.status === 403) throw new UploadError(data?.error ?? "You don't have permission to upload here.");
  // A redirect to an HTML page (e.g. a sign-in screen) means the session is gone.
  if (!data && res.redirected) throw new UploadError(SESSION_EXPIRED_MESSAGE);
  if (!res.ok || !data?.signature || !data.cloudName || !data.apiKey || !data.timestamp) {
    throw new UploadError(data?.error ?? "Could not start the upload. Please try again.", res.status >= 500);
  }
  return data as SignedUpload;
}

function waitForOnline(signal?: AbortSignal): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener("online", done);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      window.removeEventListener("online", done);
      reject(abortError());
    };
    window.addEventListener("online", done);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

type PartResult = { done: true; info: UploadInfo } | { done: false };

/** POST one request (whole file or one chunk) with stall + response timeouts. */
function sendPart(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  isLast: boolean,
  onBytes: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<PartResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        xhr.abort();
      }, ms);
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => xhr.abort();

    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      arm(STALL_MS);
      if (e.lengthComputable) onBytes(e.loaded);
    };
    // Bytes are all sent — now wait (longer) for Cloudinary to process.
    xhr.upload.onload = () => arm(RESPONSE_TIMEOUT_MS);
    xhr.onload = () => {
      cleanup();
      const parsed = parseCloudinaryUploadResponse<UploadInfo>(xhr.status, xhr.responseText);
      if (parsed.ok) return resolve({ done: true, info: parsed.info });
      // Intermediate chunks return 2xx without a secure_url.
      if (!isLast && xhr.status >= 200 && xhr.status < 300) return resolve({ done: false });
      reject(new UploadError(parsed.error, parsed.retryable));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new UploadError(NETWORK_LOST_MESSAGE, true));
    };
    xhr.onabort = () => {
      cleanup();
      if (timedOut) reject(new UploadError("The upload stalled. Please check your connection and retry.", true));
      else reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    arm(STALL_MS);
    xhr.send(form);
  });
}

function newUploadId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `nut${rand}`.slice(0, 40);
}

export type UploadOptions = {
  /** Folder under `nutriyet/` (sanitized server-side). */
  folder?: string;
  /** Media kind to sign (pins Cloudinary's allowed_formats). Omit for JNV documents. */
  kind?: MediaKind | "file";
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  /** Override how the signature is obtained (e.g. the marketing-kit endpoint). */
  sign?: () => Promise<SignedUpload>;
};

/**
 * Upload a blob to Cloudinary. Resolves with Cloudinary's full response
 * (URL + dimensions, duration, bytes, format, codec, …).
 */
export async function uploadToCloudinary(blob: Blob, filename: string, opts: UploadOptions = {}): Promise<UploadInfo> {
  const { folder, kind, onProgress, signal } = opts;
  const release = trackUpload();
  try {
    const sig = await (opts.sign ? opts.sign() : requestSignature("/api/admin/upload-signature", { folder, kind }));
    if (signal?.aborted) throw abortError();
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/auto/upload`;
    const total = blob.size;
    const chunked = total > CHUNK_THRESHOLD;
    const uploadId = chunked ? newUploadId() : "";
    let lastPct = -1;
    const report = (sent: number) => {
      const pct = Math.min(100, Math.round((sent / Math.max(total, 1)) * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress?.(pct);
      }
    };
    report(0);

    for (let start = 0; ; ) {
      const end = chunked ? Math.min(start + CHUNK_SIZE, total) : total;
      const isLast = end >= total;
      const piece = chunked ? blob.slice(start, end) : blob;
      const headers: Record<string, string> = chunked
        ? { "X-Unique-Upload-Id": uploadId, "Content-Range": `bytes ${start}-${end - 1}/${total}` }
        : {};

      for (let attempt = 1; ; attempt++) {
        const form = new FormData();
        form.append("file", piece, filename);
        form.append("api_key", sig.apiKey);
        form.append("timestamp", String(sig.timestamp));
        form.append("signature", sig.signature);
        // Signed params must be resent verbatim (Cloudinary re-derives the signature).
        if (sig.folder) form.append("folder", sig.folder);
        if (sig.allowed_formats) form.append("allowed_formats", sig.allowed_formats);
        try {
          const res = await sendPart(endpoint, form, headers, isLast, (loaded) => report(start + loaded), signal);
          if (res.done) {
            report(total);
            return res.info;
          }
          break; // next chunk
        } catch (err) {
          if (isAbortError(err)) throw err;
          const retryable = err instanceof UploadError && err.retryable;
          if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
          await waitForOnline(signal);
          await sleep(1000 * 2 ** (attempt - 1), signal);
          report(start);
        }
      }
      // A non-final chunk was accepted (the final one always returns above or throws).
      start = end;
    }
  } finally {
    release();
  }
}
