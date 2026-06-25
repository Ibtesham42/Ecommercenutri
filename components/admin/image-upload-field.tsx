"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImageAction } from "@/lib/actions/admin/upload";
import { isVideoUrl } from "@/lib/cld";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Image (or video) field that uploads to Cloudinary when configured and always
 * accepts a pasted URL as a fallback. Controlled via `value` / `onChange`.
 */
export function ImageUploadField({
  value,
  onChange,
  cloudinaryReady,
  folder,
  accept = "image/*",
  placeholder = "https://… or upload",
}: {
  value?: string;
  onChange: (url: string) => void;
  cloudinaryReady: boolean;
  folder?: string;
  accept?: string;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is too large (max 8 MB).");
      return;
    }
    setUploading(true);
    try {
      const dataUri = await fileToDataUri(file);
      const res = await uploadImageAction(dataUri, folder);
      if (res.ok && res.data) {
        onChange(res.data.url);
        toast.success("Uploaded");
      } else {
        toast.error(res.ok ? "Upload failed." : res.error);
      }
    } catch {
      toast.error("Could not read that file.");
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
