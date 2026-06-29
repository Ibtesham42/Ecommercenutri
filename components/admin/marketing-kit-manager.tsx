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
import { saveMarketingAsset, deleteMarketingAsset } from "@/lib/actions/admin/affiliates";
import { MARKETING_ASSET_TYPES } from "@/lib/validations/affiliate";
import { MARKETING_ASSET_LABEL } from "@/lib/affiliate/labels";
import { cldUrl } from "@/lib/cld";

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

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("PRODUCT_IMAGE");
  const [fileUrl, setFileUrl] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/affiliate-asset", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Upload failed");
      setFileUrl(json.url);
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
                      accept="image/*,video/*,application/pdf"
                      className="hidden"
                      onChange={onPick}
                      disabled={uploading}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                      {fileUrl ? "Replace file" : "Upload image / video / PDF"}
                    </span>
                  </label>
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
