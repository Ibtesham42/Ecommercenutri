"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UploadError, uploadErrorMessage, uploadToCloudinary } from "@/lib/admin/direct-upload";
import { prepareImage, preparedImageTooLarge } from "@/lib/admin/prepare-image";
import { trackUpload } from "@/lib/admin/upload-activity";
import { IMAGE_ACCEPT, checkMediaFile, mediaRequirements } from "@/lib/upload-rules";

const MAX_FILES = 10;

/**
 * Drag-and-drop multi-image upload zone. Accepts up to 10 images at once
 * (drop or browse), compresses each client-side and uploads DIRECTLY to
 * Cloudinary (same signed pipeline as ImageUploadField), then hands back the
 * uploaded URLs in selection order. Renders nothing when Cloudinary isn't
 * configured — the URL-paste rows next to it remain the keyless fallback.
 */
export function MultiImageDrop({
  cloudinaryReady,
  folder,
  onUploaded,
  label = "Drop images here, or browse",
}: {
  cloudinaryReady: boolean;
  folder?: string;
  onUploaded: (urls: string[]) => void;
  label?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number; pct: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  async function handleFiles(list: FileList | null) {
    if (!list || busyRef.current) return;
    const files = Array.from(list);
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(`Up to ${MAX_FILES} images at a time.`);
      return;
    }
    busyRef.current = true;
    const release = trackUpload();
    setBusy({ done: 0, total: files.length, pct: 0 });
    const urls: string[] = [];
    const failures: string[] = [];
    try {
      // Sequential upload keeps the resulting order = the order picked.
      for (const file of files) {
        const problem = checkMediaFile(file, "image");
        if (problem) {
          failures.push(`${file.name}: ${problem}`);
        } else {
          try {
            const { blob, filename } = await prepareImage(file);
            const tooLarge = preparedImageTooLarge(blob);
            if (tooLarge) throw new UploadError(tooLarge);
            const info = await uploadToCloudinary(blob, filename, {
              folder,
              kind: "image",
              onProgress: (pct) => setBusy((b) => (b ? { ...b, pct } : b)),
            });
            urls.push(info.secure_url);
          } catch (err) {
            console.error("[multi-image-drop] failed:", err);
            failures.push(`${file.name}: ${uploadErrorMessage(err)}`);
          }
        }
        setBusy((b) => (b ? { ...b, done: b.done + 1, pct: 0 } : b));
      }
    } finally {
      release();
      busyRef.current = false;
      setBusy(null);
    }
    if (urls.length > 0) {
      onUploaded(urls);
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} uploaded successfully.`);
    }
    for (const f of failures) toast.error(f);
  }

  if (!cloudinaryReady) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border border-dashed p-4 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "hover:border-primary/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        disabled={Boolean(busy)}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? (
        <div className="space-y-2">
          <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.round(((busy.done + busy.pct / 100) / busy.total) * 100)}%` }}
            />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Uploading {Math.min(busy.done + 1, busy.total)} of {busy.total}… {busy.pct}%
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mx-auto flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ImagePlus className="size-4" />
          {label}
          <span className="text-xs font-normal">· up to {MAX_FILES} at once</span>
        </button>
      )}
      {!busy && (
        <p className="mt-1 text-[11px] text-muted-foreground">{mediaRequirements("image")}</p>
      )}
    </div>
  );
}
