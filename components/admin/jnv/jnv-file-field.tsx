"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, FileCheck2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/components/admin/image-upload-field";
import { JNV_ACCEPT, detectJnvFileKind, formatBytes, type JnvFileKind } from "@/lib/jnv/catalog";

export type JnvUploadResult = {
  url: string;
  fileKind: JnvFileKind;
  mimeType: string | null;
  fileSize: number;
  filename: string;
};

const MAX_MB = 100;

/**
 * Generic educational-file uploader for the JNV admin (PDF/PPT/DOC/XLS/image/
 * audio/video/zip). Reuses the same signed direct-to-Cloudinary flow as
 * `ImageUploadField` — files never pass through our serverless function — but
 * shows a filename/size chip instead of an image thumbnail, since most JNV
 * uploads aren't previewable inline.
 */
export function JnvFileField({
  value,
  onUploaded,
  cloudinaryReady,
  folder,
}: {
  value?: JnvUploadResult | null;
  onUploaded: (result: JnvUploadResult) => void;
  cloudinaryReady: boolean;
  folder: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is too large (max ${MAX_MB} MB).`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const info = await uploadToCloudinary(file, file.name, folder, setProgress);
      onUploaded({
        url: info.secure_url,
        fileKind: detectJnvFileKind(file.name, file.type),
        mimeType: file.type || null,
        fileSize: info.bytes ?? file.size,
        filename: file.name,
      });
      toast.success("Uploaded");
    } catch (err) {
      console.error("[jnv-file-field] upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  if (!cloudinaryReady) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        File uploads need Cloudinary configured. Ask an admin to set the Cloudinary env vars.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={JNV_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/30 p-3">
          <FileCheck2 className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.filename}</p>
            <p className="text-xs text-muted-foreground">
              {value.fileKind} · {formatBytes(value.fileSize)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Replace file"
          >
            <Upload className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full justify-center gap-2"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? `Uploading… ${progress}%` : "Choose a file to upload"}
        </Button>
      )}
      {uploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" /> choose a different file
        </button>
      )}
    </div>
  );
}
