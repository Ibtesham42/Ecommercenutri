"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  prepareBlob,
  uploadToCloudinary,
} from "@/components/admin/image-upload-field";

const MAX_FILES = 10;
const MAX_MB = 25;

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
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      toast.error("Drop image files (JPG, PNG, WebP).");
      return;
    }
    if (files.length > MAX_FILES) {
      toast.error(`Up to ${MAX_FILES} images at a time.`);
      return;
    }
    setBusy({ done: 0, total: files.length });
    const urls: string[] = [];
    // Sequential upload keeps the resulting order = the order picked.
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name} is too large (max ${MAX_MB} MB) — skipped.`);
        setBusy((b) => (b ? { ...b, done: b.done + 1 } : b));
        continue;
      }
      try {
        const { blob, filename } = await prepareBlob(file);
        const info = await uploadToCloudinary(blob, filename, folder);
        urls.push(info.secure_url);
      } catch (err) {
        console.error("[multi-image-drop] failed:", err);
        toast.error(`${file.name}: upload failed.`);
      }
      setBusy((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setBusy(null);
    if (urls.length > 0) {
      onUploaded(urls);
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added`);
    }
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
        accept="image/*"
        multiple
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
              style={{ width: `${Math.round((busy.done / busy.total) * 100)}%` }}
            />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Uploading {Math.min(busy.done + 1, busy.total)} of {busy.total}…
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
    </div>
  );
}
