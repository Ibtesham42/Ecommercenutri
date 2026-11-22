"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, X, RotateCcw, AlertCircle, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isVideoUrl } from "@/lib/cld";
import type { CloudinaryUploadInfo } from "@/lib/video";
import { acceptFor, checkMediaFile, isVideoFile, kindFromAccept, mediaRequirements, type MediaKind } from "@/lib/upload-rules";
import { isAbortError, uploadErrorMessage, uploadToCloudinary } from "@/lib/admin/direct-upload";
import { prepareImage, preparedImageTooLarge } from "@/lib/admin/prepare-image";
import { trackUpload } from "@/lib/admin/upload-activity";

/** Read a video file's duration (seconds) in the browser; 0 when unknown (never hangs). */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const finish = (d: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    // Some codecs (e.g. HEVC .mov on Windows) never fire either event.
    const timer = setTimeout(() => finish(0), 8000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => finish(v.duration);
    v.onerror = () => finish(0);
    v.src = url;
  });
}

type Phase = "idle" | "checking" | "preparing" | "uploading" | "processing";

/**
 * Image (or video) field that uploads DIRECTLY to Cloudinary when configured
 * and always accepts a pasted URL as a fallback. Controlled via `value` /
 * `onChange` — `onChange` fires only after a successful upload, so a failed
 * or cancelled upload never leaves a broken URL / misleading preview behind.
 */
export function ImageUploadField({
  value,
  onChange,
  cloudinaryReady,
  folder,
  accept,
  kind: kindProp,
  placeholder = "https://… or upload",
  maxDurationSec,
  onUploadInfo,
  successMessage,
}: {
  value?: string;
  onChange: (url: string) => void;
  cloudinaryReady: boolean;
  folder?: string;
  /** Legacy file-picker filter; used to infer `kind` when that isn't given. */
  accept?: string;
  kind?: MediaKind;
  placeholder?: string;
  /** When set, reject video files longer than this (seconds) before upload. */
  maxDurationSec?: number;
  /** Called with Cloudinary's full response (dimensions, duration, codec, …). */
  onUploadInfo?: (info: CloudinaryUploadInfo) => void;
  successMessage?: string;
}) {
  const kind = kindProp ?? kindFromAccept(accept);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; file: File | null } | null>(null);
  const [localPreview, setLocalPreview] = useState<{ url: string; video: boolean } | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the dialog mid-upload cancels the upload (and frees the Save lock).
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => setPreviewBroken(false), [value]);
  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview.url);
  }, [localPreview]);

  const busy = phase !== "idle";

  async function handleFile(file: File) {
    if (busyRef.current) return; // one upload at a time per field
    setError(null);
    const problem = checkMediaFile(file, kind);
    if (problem) {
      toast.error(problem);
      setError({ message: problem, file: null });
      return;
    }

    busyRef.current = true;
    const release = trackUpload();
    const ac = new AbortController();
    abortRef.current = ac;
    const isVideo = isVideoFile(file);
    setProgress(0);
    setLocalPreview({ url: URL.createObjectURL(file), video: isVideo });
    try {
      if (isVideo && maxDurationSec) {
        setPhase("checking");
        const dur = await videoDuration(file);
        if (dur && dur > maxDurationSec + 0.5) {
          const msg = `Video is too long (${Math.round(dur)}s). Max is ${maxDurationSec}s — trim it and retry.`;
          toast.error(msg);
          setError({ message: msg, file: null });
          return;
        }
      }
      let blob: Blob = file;
      let filename = file.name || "upload";
      if (!isVideo) {
        setPhase("preparing");
        ({ blob, filename } = await prepareImage(file));
        const tooLarge = preparedImageTooLarge(blob);
        if (tooLarge) {
          toast.error(tooLarge);
          setError({ message: tooLarge, file: null });
          return;
        }
      }
      // Cancelled while checking/preparing → same feedback as a cancelled upload.
      if (ac.signal.aborted) throw new DOMException("Upload cancelled.", "AbortError");
      setPhase("uploading");
      const info = await uploadToCloudinary(blob, filename, {
        folder,
        kind,
        signal: ac.signal,
        onProgress: (pct) => {
          setProgress(pct);
          if (pct >= 100) setPhase("processing");
        },
      });
      onChange(info.secure_url);
      onUploadInfo?.(info);
      toast.success(successMessage ?? `${isVideo ? "Video" : "Image"} uploaded successfully.`);
    } catch (err) {
      if (isAbortError(err)) {
        toast.info("Upload cancelled.");
        return;
      }
      console.error("[image-upload] failed:", err);
      const message = uploadErrorMessage(err);
      toast.error(message);
      setError({ message, file });
    } finally {
      release();
      busyRef.current = false;
      abortRef.current = null;
      setPhase("idle");
      setProgress(0);
      setLocalPreview(null);
    }
  }

  const showVideo = value ? isVideoUrl(value) : false;
  const what = kind === "video" ? "video" : kind === "media" ? "image or video" : "image";
  const statusText =
    phase === "checking"
      ? "Checking video…"
      : phase === "preparing"
        ? "Preparing image…"
        : phase === "processing"
          ? "Processing on Cloudinary…"
          : `Uploading… ${progress}%`;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          aria-label={`${what} URL`}
        />
        {cloudinaryReady && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept ?? acceptFor(kind)}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label={busy ? `Uploading ${what}` : `Upload ${what}`}
              title={`Upload ${what}`}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            </Button>
          </>
        )}
      </div>

      {cloudinaryReady && !busy && !error && (
        <p className="text-[11px] leading-snug text-muted-foreground">{mediaRequirements(kind, { maxDurationSec })}</p>
      )}

      {busy && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${phase === "uploading" ? progress : phase === "processing" ? 100 : 4}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{statusText}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => abortRef.current?.abort()}
            >
              <X className="size-3" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {error && !busy && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{error.message}</span>
          {error.file && (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 font-medium underline-offset-2 hover:underline"
              onClick={() => error.file && void handleFile(error.file)}
            >
              <RotateCcw className="size-3" /> Retry
            </button>
          )}
          <button type="button" aria-label="Dismiss error" className="shrink-0" onClick={() => setError(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {(localPreview || value) && (
        <div className="relative size-20 overflow-hidden rounded-lg border bg-accent/30">
          {localPreview ? (
            localPreview.video ? (
              <video src={localPreview.url} muted playsInline preload="metadata" className="size-full object-cover opacity-60" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={localPreview.url} alt="Uploading preview" className="size-full object-cover opacity-60" />
            )
          ) : previewBroken ? (
            <div className="grid h-full place-items-center p-1 text-center text-[10px] text-muted-foreground">
              <ImageOff className="mx-auto size-4" />
              Preview unavailable
            </div>
          ) : showVideo ? (
            <video
              src={value}
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
              onError={() => setPreviewBroken(true)}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="Preview" className="size-full object-cover" onError={() => setPreviewBroken(true)} />
          )}
          {localPreview ? (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
