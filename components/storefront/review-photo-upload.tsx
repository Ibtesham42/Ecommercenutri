"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { MAX_REVIEW_PHOTOS } from "@/lib/validations/review";
import { cn } from "@/lib/utils";

const MAX_DIM = 1600;
const MAX_FILE_MB = 15;

/** Shrink a photo client-side (resize to a max edge + recompress JPEG) before
 *  upload. Self-contained (not shared with admin) to match the precedent set
 *  by `components/account/avatar-upload.tsx` for customer-facing uploads. */
async function prepareBlob(file: File): Promise<{ blob: Blob; filename: string }> {
  const fallback = { blob: file, filename: file.name || "review-photo.jpg" };
  if (typeof createImageBitmap !== "function") return fallback;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest > MAX_DIM) {
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return fallback;
    const base = (file.name || "review-photo").replace(/\.[^.]+$/, "");
    return { blob, filename: `${base}.jpg` };
  } catch {
    return fallback;
  }
}

async function uploadReviewPhoto(blob: Blob, filename: string): Promise<string> {
  const sigRes = await fetch("/api/account/review-photo-signature", { method: "POST" });
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

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const up = (await upRes.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!upRes.ok || !up.secure_url) {
    throw new Error(up.error?.message ?? "Upload failed.");
  }
  return up.secure_url;
}

type Photo = { url: string; uploading: boolean };

/**
 * Multi-photo picker for a customer review: client-resize + direct signed
 * upload to Cloudinary (invariant #5), local preview while uploading, and
 * remove/reorder controls before the review is submitted.
 */
export function ReviewPhotoUpload({
  value,
  onChange,
  cloudinaryReady,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  cloudinaryReady: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local uploading state keyed by object-URL so we can show a spinner over a
  // preview immediately, then swap it for the real Cloudinary URL in place.
  const [photos, setPhotos] = useState<Photo[]>(() => value.map((url) => ({ url, uploading: false })));

  function commit(next: Photo[]) {
    setPhotos(next);
    onChange(next.filter((p) => !p.uploading).map((p) => p.url));
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    const room = MAX_REVIEW_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_REVIEW_PHOTOS} photos.`);
      return;
    }
    const picked = files.slice(0, room);
    if (files.length > picked.length) {
      toast.error(`Only ${MAX_REVIEW_PHOTOS} photos per review — added the first ${picked.length}.`);
    }

    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" isn't an image.`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" is too large (max ${MAX_FILE_MB} MB).`);
        continue;
      }
      const localUrl = URL.createObjectURL(file);
      setPhotos((prev) => {
        const next = [...prev, { url: localUrl, uploading: true }];
        return next;
      });
      try {
        const { blob, filename } = await prepareBlob(file);
        const uploadedUrl = await uploadReviewPhoto(blob, filename);
        setPhotos((prev) => {
          const next = prev.map((p) => (p.url === localUrl ? { url: uploadedUrl, uploading: false } : p));
          onChange(next.filter((p) => !p.uploading).map((p) => p.url));
          return next;
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
        setPhotos((prev) => {
          const next = prev.filter((p) => p.url !== localUrl);
          onChange(next.filter((p) => !p.uploading).map((p) => p.url));
          return next;
        });
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    }
  }

  function remove(url: string) {
    commit(photos.filter((p) => p.url !== url));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  if (!cloudinaryReady) return null;

  return (
    <div className="space-y-2.5">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {photos.map((p, i) => (
            <div
              key={p.url}
              className="group relative size-16 shrink-0 overflow-hidden rounded-xl border bg-accent/30 sm:size-20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.uploading ? p.url : cldUrl(p.url, { w: 200, h: 200, crop: "fill" })}
                alt={`Selected photo ${i + 1}`}
                className={cn("size-full object-cover", p.uploading && "opacity-50")}
              />
              {p.uploading && (
                <div className="absolute inset-0 grid place-items-center bg-background/40">
                  <Loader2 className="size-5 animate-spin text-foreground" />
                </div>
              )}
              {!p.uploading && (
                <>
                  <button
                    type="button"
                    onClick={() => remove(p.url)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-gradient-to-t from-black/60 to-transparent pb-0.5 pt-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move photo ${i + 1} earlier`}
                      className="grid size-5 place-items-center rounded-full text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === photos.length - 1}
                      aria-label={`Move photo ${i + 1} later`}
                      className="grid size-5 place-items-center rounded-full text-white disabled:opacity-30"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.length < MAX_REVIEW_PHOTOS && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPick}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-accent/40 hover:text-foreground"
          >
            {photos.length > 0 ? <Camera className="size-4" /> : <ImagePlus className="size-4" />}
            {photos.length > 0 ? "Add more photos" : "Add photos"}
          </button>
        </>
      )}
      <p className="text-xs text-muted-foreground">Up to {MAX_REVIEW_PHOTOS} photos — optional.</p>
    </div>
  );
}
