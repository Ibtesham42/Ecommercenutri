"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isVideoUrl } from "@/lib/cld";

// Raster types the browser can downscale/recompress before upload. Others
// (svg, gif, video) are sent untouched so they're preserved.
const COMPRESSIBLE = ["image/jpeg", "image/png", "image/webp"];
const MAX_DIM = 1600;

/**
 * Shrink a large raster image client-side (resize to a max edge + recompress)
 * and return a Blob to upload. PNGs are re-encoded as JPEG when downscaled
 * (lossless PNG photos stay huge otherwise) — except we keep PNG when it's
 * already small enough to be a logo/icon with possible transparency. Falls back
 * to the original file on any failure.
 */
async function prepareBlob(file: File): Promise<{ blob: Blob; filename: string }> {
  const fallback = { blob: file, filename: file.name || "upload" };
  if (!COMPRESSIBLE.includes(file.type) || typeof createImageBitmap !== "function") {
    return fallback;
  }
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const longest = Math.max(width, height);
    const needsResize = longest > MAX_DIM;
    // Small PNGs/WebP (likely logos) stay as-is to preserve transparency.
    if (!needsResize && file.type !== "image/jpeg" && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close();
      return fallback;
    }
    if (needsResize) {
      const scale = MAX_DIM / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fallback;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return fallback;
    const base = (file.name || "upload").replace(/\.[^.]+$/, "");
    return { blob, filename: `${base}.jpg` };
  } catch {
    return fallback;
  }
}

/**
 * Upload a blob DIRECTLY to Cloudinary from the browser. We first ask our
 * admin-gated endpoint for a signature, then POST the file straight to
 * Cloudinary's API. This bypasses the app's serverless function entirely, so
 * large files (videos) aren't capped by Vercel's ~4.5 MB request-body limit or
 * the function execution timeout. Returns the delivered secure URL.
 */
async function uploadToCloudinary(
  blob: Blob,
  filename: string,
  folder?: string,
): Promise<string> {
  const sigRes = await fetch("/api/admin/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  const sig = (await sigRes.json().catch(() => ({}))) as {
    cloudName?: string;
    apiKey?: string;
    timestamp?: number;
    signature?: string;
    folder?: string;
    error?: string;
  };
  if (!sigRes.ok || !sig.signature || !sig.cloudName) {
    throw new Error(sig.error ?? "Could not start the upload.");
  }

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("api_key", sig.apiKey ?? "");
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  if (sig.folder) form.append("folder", sig.folder);

  // `auto` lets Cloudinary detect image vs video from the bytes.
  const upRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
    { method: "POST", body: form },
  );
  const up = (await upRes.json().catch(() => ({}))) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!upRes.ok || !up.secure_url) {
    throw new Error(up.error?.message ?? "Cloudinary upload failed.");
  }
  return up.secure_url;
}

/**
 * Image (or video) field that uploads to Cloudinary when configured and always
 * accepts a pasted URL as a fallback. Controlled via `value` / `onChange`.
 */
/** Read a video file's duration (seconds) in the browser, best-effort. */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

export function ImageUploadField({
  value,
  onChange,
  cloudinaryReady,
  folder,
  accept = "image/*",
  placeholder = "https://… or upload",
  maxDurationSec,
}: {
  value?: string;
  onChange: (url: string) => void;
  cloudinaryReady: boolean;
  folder?: string;
  accept?: string;
  placeholder?: string;
  /** When set, reject video files longer than this (seconds) before upload. */
  maxDurationSec?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const isVideo = file.type.startsWith("video/");
    // Generous raw guard (large originals are downscaled before upload below).
    // Videos upload directly to Cloudinary, so they aren't bound by the app's
    // serverless request limit — allow up to Cloudinary's free-plan video cap.
    const maxMb = isVideo ? 100 : 25;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(
        isVideo
          ? "That video is too large (max 100 MB). Compress it, or paste a Cloudinary URL."
          : "That file is very large (max 25 MB). Try a smaller image.",
      );
      return;
    }
    // Enforce a maximum video duration when requested (banner videos = 15s).
    if (isVideo && maxDurationSec) {
      const dur = await videoDuration(file);
      if (dur && dur > maxDurationSec + 0.5) {
        toast.error(`Video is too long (${Math.round(dur)}s). Max is ${maxDurationSec}s — trim it and retry.`);
        return;
      }
    }
    setUploading(true);
    try {
      const { blob, filename } = await prepareBlob(file);
      const url = await uploadToCloudinary(blob, filename, folder);
      onChange(url);
      toast.success("Uploaded");
    } catch (err) {
      console.error("[image-upload] failed:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const showVideo = value ? isVideoUrl(value) : false;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {cloudinaryReady && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label="Upload image"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {value && (
        <div className="relative size-20 overflow-hidden rounded-lg border bg-accent/30">
          {showVideo ? (
            <div className="grid h-full place-items-center text-[10px] text-muted-foreground">
              video
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="preview" className="size-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Clear"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
