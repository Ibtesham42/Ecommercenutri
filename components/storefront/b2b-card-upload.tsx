"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cldUrl } from "@/lib/cld";
import { MAX_B2B_CARD_MB } from "@/lib/validations/b2b";

const ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
const ACCEPTED_EXT = /\.(jpe?g|png|pdf)$/i;

type Card = { url: string; name: string; isPdf: boolean };

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

type SignatureResponse = {
  cloudName?: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  allowed_formats?: string;
  error?: string;
};

async function uploadBusinessCard(file: File, onProgress: (pct: number) => void): Promise<string> {
  const sigRes = await fetch("/api/b2b/business-card-signature", { method: "POST" });
  const sig = (await sigRes.json().catch(() => ({}))) as SignatureResponse;
  if (!sigRes.ok || !sig.signature || !sig.cloudName) {
    throw new Error(sig.error ?? "Could not start the upload.");
  }

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("api_key", sig.apiKey ?? "");
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  if (sig.folder) form.append("folder", sig.folder);
  if (sig.allowed_formats) form.append("allowed_formats", sig.allowed_formats);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let res: { secure_url?: string; error?: { message?: string } } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        /* handled by the fallback error below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
        resolve(res.secure_url);
      } else {
        reject(new Error(res.error?.message ?? "Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — please check your connection."));
    xhr.send(form);
  });
}

/**
 * Optional single-file "visiting / business card" picker for the B2B inquiry
 * form. JPG/PNG/PDF, client-validated type + size, direct signed browser→
 * Cloudinary upload (invariant #5) — this form has no login, so the signature
 * route is IP rate-limited and signs `allowed_formats` so Cloudinary itself
 * rejects anything else before accepting bytes.
 */
export function B2BCardUpload({
  value,
  onChange,
  cloudinaryReady,
}: {
  value: string;
  onChange: (url: string) => void;
  cloudinaryReady: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [card, setCard] = useState<Card | null>(
    value ? { url: value, name: "Business card", isPdf: isPdfUrl(value) } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingName, setPendingName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  if (!cloudinaryReady) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const looksAccepted = ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXT.test(file.name);
    if (!looksAccepted) {
      toast.error("Please upload a JPG, PNG or PDF file.");
      return;
    }
    if (file.size > MAX_B2B_CARD_MB * 1024 * 1024) {
      toast.error(`File is too large (max ${MAX_B2B_CARD_MB} MB).`);
      return;
    }

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const localPreview = isPdf ? null : URL.createObjectURL(file);
    setPendingName(file.name);
    setPreview(localPreview);
    setProgress(0);
    setUploading(true);
    try {
      const url = await uploadBusinessCard(file, setProgress);
      setCard({ url, name: file.name, isPdf });
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setPreview(null);
    }
  }

  function remove() {
    setCard(null);
    onChange("");
  }

  return (
    <div className="space-y-1.5">
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />

      {!card && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-accent/40 hover:text-foreground sm:w-auto"
        >
          <Paperclip className="size-4" />
          Upload Visiting / Business Card
        </button>
      )}

      {uploading && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/20 p-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-background">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <FileText className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pendingName}</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        </div>
      )}

      {card && !uploading && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/20 p-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-background">
            {card.isPdf ? (
              <FileText className="size-5 text-muted-foreground" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cldUrl(card.url, { w: 100, h: 100, crop: "fill" })}
                alt="Business card preview"
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{card.name}</p>
            <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {card.isPdf ? "View PDF" : "View image"}
            </a>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remove business card"
            className="text-muted-foreground hover:text-destructive"
            onClick={remove}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Optional — JPG, PNG or PDF, up to {MAX_B2B_CARD_MB} MB.
      </p>
    </div>
  );
}
