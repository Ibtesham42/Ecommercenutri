"use client";

import { useRef, useState } from "react";
import { Loader2, UploadCloud, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cldUrl } from "@/lib/cld";
import { processShowcaseImage } from "@/lib/showcase-image";
import { isAbortError, uploadErrorMessage, uploadToCloudinary } from "@/lib/admin/direct-upload";
import { trackUpload } from "@/lib/admin/upload-activity";
import { checkMediaFile } from "@/lib/upload-rules";

const CHECKER =
  "repeating-conic-gradient(#e5e7eb 0% 25%, #f8fafc 0% 50%) 0 0 / 16px 16px";

/**
 * Uploads DIRECTLY to Cloudinary from the browser (signed, via the same
 * pattern as ImageUploadField) instead of through this app's serverless
 * function — a showcase original can be a multi-MB photo, which a
 * server-buffered route would fail on above Vercel's ~4.5 MB body limit.
 */
async function uploadBlob(
  blob: Blob,
  filename: string,
  folder: string,
  signal: AbortSignal,
  onProgress: (pct: number) => void,
): Promise<string> {
  const info = await uploadToCloudinary(blob, filename, { folder, kind: "image", signal, onProgress });
  return info.secure_url;
}

/**
 * Showcase-specific image uploader: admin picks ONE image and we EXIF-correct it,
 * remove the background in-browser, auto-frame the product, and upload BOTH the
 * original (→ `image`) and the cutout (→ `imagePng`). Keyless fallback (no
 * Cloudinary): paste an image URL. Cancel/replace is race-safe (token + abort).
 */
export function ShowcaseImageField({
  image,
  imagePng,
  onChange,
  cloudinaryReady,
  folder = "showcase",
}: {
  image: string;
  imagePng: string | null;
  onChange: (next: { image: string; imagePng: string | null }) => void;
  cloudinaryReady: boolean;
  folder?: string;
}) {
  const [removeBg, setRemoveBg] = useState(true);
  const [status, setStatus] = useState<"idle" | "processing" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);

  async function run(file: File, removeBackground: boolean) {
    const problem = checkMediaFile(file, "image");
    if (problem) {
      toast.error(problem);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const token = ++tokenRef.current;
    fileRef.current = file;
    setStatus("processing");
    setProgress(0);
    const release = trackUpload();
    try {
      const result = await processShowcaseImage(file, {
        removeBg: removeBackground,
        signal: ac.signal,
        onProgress: (r) => {
          if (token === tokenRef.current) setProgress(Math.round(r * 100));
        },
      });
      if (token !== tokenRef.current) return;
      setStatus("uploading");
      setProgress(0);
      const onProgress = (pct: number) => {
        if (token === tokenRef.current) setProgress(pct);
      };
      // Cancel/replace aborts the in-flight request via the same signal.
      const imageUrl = await uploadBlob(result.originalBlob, "showcase-original.jpg", folder, ac.signal, onProgress);
      let pngUrl: string | null = null;
      if (result.cutoutBlob) {
        pngUrl = await uploadBlob(result.cutoutBlob, "showcase-cutout.png", folder, ac.signal, onProgress);
      }
      if (token !== tokenRef.current) return;
      onChange({ image: imageUrl, imagePng: pngUrl });
      if (result.warning) toast.warning(result.warning);
      else toast.success(result.removed ? "Image uploaded — background removed & framed." : "Image uploaded successfully.");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("[showcase-image] failed:", err);
      const isUpload = (err as Error)?.name === "UploadError";
      toast.error(isUpload ? uploadErrorMessage(err) : (err as Error)?.message || "Couldn't process the image. Please try again.");
    } finally {
      release();
      if (token === tokenRef.current) {
        setStatus("idle");
        setProgress(0);
      }
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) run(f, removeBg);
  }

  function clearImage() {
    abortRef.current?.abort();
    tokenRef.current++;
    fileRef.current = null;
    setStatus("idle");
    onChange({ image: "", imagePng: null });
  }

  const busy = status !== "idle";
  const previewUrl = imagePng || image;
  const isCutout = Boolean(imagePng);

  return (
    <div className="space-y-3">
      {cloudinaryReady && (
        <>
          {/* Preview + drop/pick */}
          <div className="flex items-center gap-3">
            <div
              className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border"
              style={isCutout ? { background: CHECKER } : undefined}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cldUrl(previewUrl, { w: 200, h: 200, crop: "fit" })}
                  alt=""
                  className="size-full object-contain"
                />
              ) : (
                <ImageOff className="size-7 text-muted-foreground/40" />
              )}
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-background/70 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <label className="inline-flex">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} disabled={busy} />
                <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                  <UploadCloud className="size-4" />
                  {previewUrl ? "Replace image" : "Upload image"}
                </span>
              </label>
              {busy ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {status === "processing"
                      ? `Removing background… ${progress}%`
                      : `Uploading… ${progress}%`}
                  </span>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={clearImage}>
                    <X className="size-3" /> Cancel
                  </Button>
                </div>
              ) : (
                previewUrl && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-muted-foreground" onClick={clearImage}>
                    <X className="size-3.5" /> Remove
                  </Button>
                )
              )}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span>
              Remove background automatically
              <span className="ml-1 text-xs text-muted-foreground">(recommended)</span>
            </span>
            <Switch
              checked={removeBg}
              disabled={busy}
              onCheckedChange={(v) => {
                setRemoveBg(v);
                if (fileRef.current) run(fileRef.current, v);
              }}
              aria-label="Remove background automatically"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Upload any photo (JPG, PNG, WebP — any orientation). It&rsquo;s
            EXIF-corrected, the product is isolated, centered and framed, then placed
            into the 3D showcase. No editing needed.
          </p>
        </>
      )}

      {/* Keyless fallback: paste a URL */}
      <div className="space-y-1.5">
        <Label htmlFor="showcase-url" className="text-xs text-muted-foreground">
          {cloudinaryReady ? "…or paste an image URL" : "Paste an image URL"}
        </Label>
        <Input
          id="showcase-url"
          placeholder="https://…"
          defaultValue={image}
          onBlur={(e) => {
            const url = e.target.value.trim();
            if (url && url !== image) onChange({ image: url, imagePng: null });
          }}
        />
      </div>
    </div>
  );
}
