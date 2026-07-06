"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { updateAvatar } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

const AVATAR_DIM = 512;

/** Square-crop + downscale to 512px JPEG in the browser before upload. */
async function prepareAvatar(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(side, AVATAR_DIM);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out,
    );
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Profile photo: circular preview with an initial fallback; uploads directly
 * to Cloudinary via the account-scoped signature route, then persists the URL.
 */
export function AvatarUpload({
  image,
  name,
  cloudinaryReady,
}: {
  image: string | null;
  name: string | null;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("That image is too large (max 10 MB).");
      return;
    }
    setBusy(true);
    try {
      const sigRes = await fetch("/api/account/avatar-signature", { method: "POST" });
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

      const blob = await prepareAvatar(file);
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");
      form.append("api_key", sig.apiKey ?? "");
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      if (sig.folder) form.append("folder", sig.folder);

      const upRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      const up = (await upRes.json().catch(() => ({}))) as {
        secure_url?: string;
        error?: { message?: string };
      };
      if (!upRes.ok || !up.secure_url) {
        throw new Error(up.error?.message ?? "Upload failed.");
      }

      const saved = await updateAvatar(up.secure_url);
      if (saved?.error) throw new Error(saved.error);
      toast.success("Photo updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await updateAvatar("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const initial = (name?.trim()?.[0] ?? "N").toUpperCase();

  return (
    <div className="relative size-16 shrink-0">
      <div
        className={cn(
          "grid size-16 place-items-center overflow-hidden rounded-full bg-primary/10 font-heading text-xl font-bold text-primary ring-2 ring-primary/15",
          busy && "opacity-60",
        )}
      >
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </div>

      {cloudinaryReady && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Change profile photo"
            className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-elev-2 transition-transform motion-safe:hover:scale-110 motion-safe:active:scale-95"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </button>
          {image && !busy && (
            <button
              type="button"
              onClick={() => void remove()}
              aria-label="Remove photo"
              className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground/70 text-background transition-colors hover:bg-destructive"
            >
              <X className="size-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
