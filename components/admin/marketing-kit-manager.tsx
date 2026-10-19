"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, UploadCloud, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveMarketingAsset, deleteMarketingAsset, verifyMarketingUpload } from "@/lib/actions/admin/affiliates";
import { MARKETING_UPLOAD_ACCEPT, checkMarketingFile } from "@/lib/affiliate/marketing-upload-rules";
import { MARKETING_ASSET_TYPES } from "@/lib/validations/affiliate";
import { MARKETING_ASSET_LABEL } from "@/lib/affiliate/labels";
import { cldUrl } from "@/lib/cld";

type Signed = {
  cloudName?: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  allowed_formats?: string;
  error?: string;
};

/**
 * Upload straight from the browser to Cloudinary with a server-issued signature —
 * the bytes never touch our serverless function (Vercel's ~4.5 MB body cap would
 * break videos and PDFs). Credentials + signing stay server-side.
 */
async function directUpload(file: File, onProgress: (pct: number) => void): Promise<string> {
  const sigRes = await fetch("/api/admin/affiliate-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  const sig = (await sigRes.json().catch(() => ({}))) as Signed;
  if (!sigRes.ok || !sig.signature || !sig.cloudName) throw new Error(sig.error ?? "Could not start the upload.");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey ?? "");
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  // Signed params must be resent verbatim.
  if (sig.folder) form.append("folder", sig.folder);
  if (sig.allowed_formats) form.append("allowed_formats", sig.allowed_formats);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let up: { secure_url?: string; error?: { message?: string } } = {};
      try {
        up = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && up.secure_url) resolve(up.secure_url);
      else reject(new Error(up.error?.message ?? "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}

type Asset = {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  isActive: boolean;
};

export function MarketingKitManager({
  assets,
  cloudinaryReady,
}: {
  assets: Asset[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("PRODUCT_IMAGE");
  const [fileUrl, setFileUrl] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkMarketingFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    setProgress(0);
    try {
      const url = await directUpload(file, setProgress);
      // The server re-checks the stored file (size can't be enforced by the signature).
      const verified = await verifyMarketingUpload(url);
      if (!verified.ok) throw new Error(verified.error);
      setFileUrl(url);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("Uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function add() {
    if (!title.trim() || !fileUrl) return toast.error("Add a title and a file.");
    setSaving(true);
    const res = await saveMarketingAsset({ title: title.trim(), type, fileUrl, isActive: true });
    setSaving(false);
    if (res.ok) {
      toast.success("Asset added");
      setOpen(false);
      setTitle("");
      setFileUrl("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this asset?")) return;
    const res = await deleteMarketingAsset(id);
    if (res.ok) {
      toast.success("Deleted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" /> Add asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add marketing asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="atitle">Title</Label>
                <Input id="atitle" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atype">Type</Label>
                <select
                  id="atype"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {MARKETING_ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MARKETING_ASSET_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>File</Label>
                {cloudinaryReady && (
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept={MARKETING_UPLOAD_ACCEPT}
                      className="hidden"
                      onChange={onPick}
                      disabled={uploading}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                      {uploading ? `Uploading… ${progress}%` : fileUrl ? "Replace file" : "Upload image / video / PDF"}
                    </span>
                  </label>
                )}
                {cloudinaryReady && (
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, MP4, MOV, WebM or PDF, up to 25 MB.</p>
                )}
                <Input
                  placeholder="…or paste a file URL"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={add} disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Add asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No marketing assets yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-xl border">
              <div className="aspect-video bg-accent/30">
                {a.thumbnailUrl || /\.(png|jpe?g|webp|gif)$/i.test(a.fileUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cldUrl(a.thumbnailUrl || a.fileUrl, { w: 320 })} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Megaphone className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {MARKETING_ASSET_LABEL[a.type as keyof typeof MARKETING_ASSET_LABEL]}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(a.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
