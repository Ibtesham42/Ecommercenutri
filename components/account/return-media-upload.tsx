"use client";

import { useState } from "react";
import { Loader2, UploadCloud, X, Film } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cldUrl, isVideoUrl } from "@/lib/cld";

const MAX_FILES = 8;

/** Multi-file proof uploader (images + short video) for return requests. Posts to
 *  /api/returns/upload; keyless fallback offers a URL-paste field. Controlled via
 *  `value` (URLs) + `onChange`. */
export function ReturnMediaUpload({
  value,
  onChange,
  cloudinaryReady,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  cloudinaryReady: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (value.length + files.length > MAX_FILES) {
      toast.error(`Up to ${MAX_FILES} files.`);
      return;
    }
    setBusy(true);
    const next = [...value];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/returns/upload", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error || "Upload failed");
        next.push(json.url);
      } catch (err) {
        toast.error((err as Error)?.message || "Upload failed");
      }
    }
    onChange(next);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative size-16 overflow-hidden rounded-lg border bg-accent/30">
              {isVideoUrl(url) ? (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <Film className="size-6" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cldUrl(url, { w: 128, h: 128, crop: "fill" })}
                  alt=""
                  className="size-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                aria-label="Remove"
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {cloudinaryReady ? (
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onPick}
            disabled={busy}
          />
          <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            {busy ? "Uploading…" : "Add photos / video"}
          </span>
        </label>
      ) : (
        <Input
          placeholder="Paste an image/video URL"
          onBlur={(e) => {
            const url = e.target.value.trim();
            if (url && !value.includes(url)) {
              onChange([...value, url].slice(0, MAX_FILES));
              e.target.value = "";
            }
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Add up to {MAX_FILES} photos or a short video as proof (optional but recommended).
      </p>
    </div>
  );
}
