"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Copy, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { BANNER_POSITIONS, BANNER_POSITION_LABELS } from "@/lib/banners";
import { cldUrl } from "@/lib/cld";
import { formatDate } from "@/lib/format";
import {
  saveBanner,
  deleteBanner,
  toggleBanner,
  duplicateBanner,
} from "@/lib/actions/admin/banners";

export type BannerRow = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  desktopImage: string;
  mobileImage: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  productId: string | null;
  categoryId: string | null;
  position: string;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
};

type Option = { id: string; name: string };

type FormValues = {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  desktopImage: string;
  mobileImage: string;
  ctaText: string;
  ctaUrl: string;
  productId: string;
  categoryId: string;
  position: string;
  priority: number;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
};

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function BannerManager({
  banners,
  products,
  categories,
  cloudinaryReady,
}: {
  banners: BannerRow[];
  products: Option[];
  categories: Option[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, reset } = useForm<FormValues>();

  function openAdd() {
    setEditing(null);
    reset({
      title: "",
      subtitle: "",
      description: "",
      desktopImage: "",
      mobileImage: "",
      ctaText: "",
      ctaUrl: "",
      productId: "",
      categoryId: "",
      position: BANNER_POSITIONS[0].key,
      priority: 0,
      isActive: true,
      startsAt: "",
      expiresAt: "",
    });
    setOpen(true);
  }
  function openEdit(b: BannerRow) {
    setEditing(b);
    reset({
      id: b.id,
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      description: b.description ?? "",
      desktopImage: b.desktopImage,
      mobileImage: b.mobileImage ?? "",
      ctaText: b.ctaText ?? "",
      ctaUrl: b.ctaUrl ?? "",
      productId: b.productId ?? "",
      categoryId: b.categoryId ?? "",
      position: b.position,
      priority: b.priority,
      isActive: b.isActive,
      startsAt: dateInput(b.startsAt),
      expiresAt: dateInput(b.expiresAt),
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveBanner({
      id: v.id,
      title: v.title || null,
      subtitle: v.subtitle || null,
      description: v.description || null,
      desktopImage: v.desktopImage,
      mobileImage: v.mobileImage || null,
      ctaText: v.ctaText || null,
      ctaUrl: v.ctaUrl || null,
      productId: v.productId || null,
      categoryId: v.categoryId || null,
      position: v.position,
      priority: Number(v.priority),
      isActive: v.isActive,
      startsAt: v.startsAt || null,
      expiresAt: v.expiresAt || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Banner updated" : "Banner created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function act(p: Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    p.then((res) => {
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> Add banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ImageOff className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No banners yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a promotional banner and choose where it appears.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {banners.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border bg-background p-3">
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(b.desktopImage, { w: 240, h: 140, crop: "fill" })}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.title || "Untitled banner"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {BANNER_POSITION_LABELS[b.position as keyof typeof BANNER_POSITION_LABELS] ?? b.position}
                  {" · priority "}
                  {b.priority}
                  {b.startsAt || b.expiresAt ? (
                    <span>
                      {" · "}
                      {b.startsAt ? `from ${formatDate(b.startsAt)}` : ""}
                      {b.expiresAt ? ` until ${formatDate(b.expiresAt)}` : ""}
                    </span>
                  ) : null}
                </p>
              </div>
              <Badge variant={b.isActive ? "default" : "secondary"}>
                {b.isActive ? "Live" : "Draft"}
              </Badge>
              <Switch
                checked={b.isActive}
                onCheckedChange={(v) => act(toggleBanner(b.id, v), v ? "Published" : "Unpublished")}
                aria-label="Toggle published"
              />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(b)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => act(duplicateBanner(b.id), "Banner duplicated")}
                  aria-label="Duplicate"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this banner?")) act(deleteBanner(b.id), "Banner deleted");
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="btitle">Title</Label>
                <Input id="btitle" {...register("title")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bsubtitle">Subtitle</Label>
                <Input id="bsubtitle" {...register("subtitle")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bdesc">Description</Label>
              <Textarea id="bdesc" rows={2} {...register("description")} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Desktop image</Label>
                <Controller
                  control={control}
                  name="desktopImage"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="banners" />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile image (optional)</Label>
                <Controller
                  control={control}
                  name="mobileImage"
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="banners" />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bposition">Placement</Label>
                <select id="bposition" {...register("position")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  {BANNER_POSITIONS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bpriority">Priority (higher shows first)</Label>
                <Input id="bpriority" type="number" {...register("priority", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcta">Button text</Label>
                <Input id="bcta" placeholder="Shop now" {...register("ctaText")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bctaurl">Button URL (if no product/category)</Label>
                <Input id="bctaurl" placeholder="/products or https://…" {...register("ctaUrl")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bproduct">Link to product</Label>
                <select id="bproduct" {...register("productId")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="">None</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcategory">Link to category</Label>
                <select id="bcategory" {...register("categoryId")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bstart">Publish date</Label>
                <Input id="bstart" type="date" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bexp">Expiry date</Label>
                <Input id="bexp" type="date" {...register("expiresAt")} />
              </div>
            </div>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Published (visible on the storefront)
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Create banner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
