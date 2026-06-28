"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Eye,
  GripVertical,
  Loader2,
  ImageOff,
  Box,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShowcaseImageField } from "@/components/admin/showcase-image-field";
import { Showcase3D } from "@/components/storefront/showcase-3d";
import { SHOWCASE_ANIMATIONS, SHOWCASE_BACKGROUNDS } from "@/lib/showcase";
import { cldUrl } from "@/lib/cld";
import type { ShowcaseDisplayItem } from "@/lib/queries/home";
import {
  saveShowcaseItem,
  deleteShowcaseItem,
  toggleShowcaseItem,
  duplicateShowcaseItem,
  reorderShowcaseItems,
  setShowcaseEnabled,
} from "@/lib/actions/admin/showcase";

export type ShowcaseRow = {
  id: string;
  title: string;
  tagline: string | null;
  image: string;
  imagePng: string | null;
  productId: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  animation: string;
  background: string;
  rotationSpeed: number;
  floatIntensity: number;
  zoom: number;
  isActive: boolean;
};

type Option = { id: string; name: string };

type FormValues = {
  id?: string;
  title: string;
  tagline: string;
  image: string;
  imagePng: string;
  productId: string;
  ctaText: string;
  ctaUrl: string;
  animation: string;
  background: string;
  rotationSpeed: number;
  floatIntensity: number;
  zoom: number;
  isActive: boolean;
};

function toPreview(v: FormValues): ShowcaseDisplayItem {
  return {
    id: "preview",
    title: v.title || "Your product",
    tagline: v.tagline || null,
    image: v.image || "https://placehold.co/900x900/16803c/ffffff?text=Product",
    imagePng: v.imagePng || null,
    href: "#",
    price: null,
    ctaText: v.ctaText || "Shop Now",
    animation: v.animation,
    background: v.background,
    rotationSpeed: Number(v.rotationSpeed),
    floatIntensity: Number(v.floatIntensity),
    zoom: Number(v.zoom),
  };
}

export function ShowcaseManager({
  items,
  products,
  enabled,
  cloudinaryReady,
}: {
  items: ShowcaseRow[];
  products: Option[];
  enabled: boolean;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const [order, setOrder] = useState<ShowcaseRow[]>(items);
  const [dragId, setDragId] = useState<string | null>(null);
  if (items.map((s) => s.id).join() !== order.map((s) => s.id).join() && dragId === null) {
    setOrder(items);
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<FormValues>();

  function openAdd() {
    setEditing(null);
    reset({
      title: "",
      tagline: "",
      image: "",
      imagePng: "",
      productId: "",
      ctaText: "",
      ctaUrl: "",
      animation: "float",
      background: "aurora",
      rotationSpeed: 50,
      floatIntensity: 50,
      zoom: 50,
      isActive: true,
    });
    setOpen(true);
  }
  function openEdit(s: ShowcaseRow) {
    setEditing(s);
    reset({
      id: s.id,
      title: s.title,
      tagline: s.tagline ?? "",
      image: s.image,
      imagePng: s.imagePng ?? "",
      productId: s.productId ?? "",
      ctaText: s.ctaText ?? "",
      ctaUrl: s.ctaUrl ?? "",
      animation: s.animation,
      background: s.background,
      rotationSpeed: s.rotationSpeed,
      floatIntensity: s.floatIntensity,
      zoom: s.zoom,
      isActive: s.isActive,
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveShowcaseItem({
      id: v.id,
      title: v.title,
      tagline: v.tagline || null,
      image: v.image,
      imagePng: v.imagePng || null,
      productId: v.productId || null,
      ctaText: v.ctaText || null,
      ctaUrl: v.ctaUrl || null,
      animation: v.animation,
      background: v.background,
      rotationSpeed: Number(v.rotationSpeed),
      floatIntensity: Number(v.floatIntensity),
      zoom: Number(v.zoom),
      isActive: v.isActive,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Showcase item updated" : "Showcase item created");
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

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = [...order];
    const from = next.findIndex((s) => s.id === dragId);
    const to = next.findIndex((s) => s.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);
    act(reorderShowcaseItems(next.map((s) => s.id)), "Order updated");
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <div>
      {/* Global enable */}
      <div className="mb-4 flex items-center justify-between rounded-xl border bg-background p-4">
        <div>
          <p className="font-medium">Show the 3D showcase on the homepage</p>
          <p className="text-sm text-muted-foreground">
            Appears at the top of the homepage. Needs at least one published item.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => act(setShowcaseEnabled(v), v ? "Showcase enabled" : "Showcase disabled")}
          aria-label="Enable 3D showcase"
        />
      </div>

      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {order.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ImageOff className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No showcase items yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a product to feature it in the premium 3D hero showcase.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {order.map((s) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.id)}
              className={`flex items-center gap-3 rounded-xl border bg-background p-3 transition ${
                dragId === s.id ? "opacity-50" : ""
              }`}
            >
              <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
                <GripVertical className="size-5" />
              </span>
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(s.image, { w: 120, h: 120, crop: "fit" })}
                  alt=""
                  className="size-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {SHOWCASE_ANIMATIONS.find((a) => a.key === s.animation)?.label ?? s.animation}
                  {s.tagline ? ` · ${s.tagline}` : ""}
                </p>
              </div>
              <Badge variant={s.isActive ? "default" : "secondary"}>
                {s.isActive ? "Live" : "Draft"}
              </Badge>
              <Switch
                checked={s.isActive}
                onCheckedChange={(v) => act(toggleShowcaseItem(s.id, v), v ? "Published" : "Unpublished")}
                aria-label="Toggle published"
              />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => act(duplicateShowcaseItem(s.id), "Item duplicated")}
                  aria-label="Duplicate"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this showcase item?")) act(deleteShowcaseItem(s.id), "Item deleted");
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

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit showcase item" : "New showcase item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stitle">Title</Label>
                <Input id="stitle" {...register("title", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stagline">Tagline</Label>
                <Input id="stagline" placeholder="Premium roasted makhana" {...register("tagline")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Product image</Label>
              {/* RHF-registered values, driven by ShowcaseImageField via setValue. */}
              <input type="hidden" {...register("image", { required: true })} />
              <input type="hidden" {...register("imagePng")} />
              <ShowcaseImageField
                image={watch("image") || ""}
                imagePng={watch("imagePng") || null}
                cloudinaryReady={cloudinaryReady}
                folder="showcase"
                onChange={({ image, imagePng }) => {
                  setValue("image", image, { shouldDirty: true, shouldValidate: true });
                  setValue("imagePng", imagePng ?? "", { shouldDirty: true });
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sproduct">Featured product</Label>
                <select id="sproduct" {...register("productId")} className={field}>
                  <option value="">None (use button URL)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scta">Button text</Label>
                  <Input id="scta" placeholder="Shop Now" {...register("ctaText")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sctaurl">Button URL</Label>
                  <Input id="sctaurl" placeholder="/products" {...register("ctaUrl")} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sanim">Animation style</Label>
                <select id="sanim" {...register("animation")} className={field}>
                  {SHOWCASE_ANIMATIONS.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sbg">Background style</Label>
                <select id="sbg" {...register("background")} className={field}>
                  {SHOWCASE_BACKGROUNDS.map((b) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="srot">Rotation speed ({watch("rotationSpeed") ?? 50})</Label>
                <input id="srot" type="range" min={0} max={100} step={5} className="h-9 w-full accent-primary" {...register("rotationSpeed", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sfloat">Floating intensity ({watch("floatIntensity") ?? 50})</Label>
                <input id="sfloat" type="range" min={0} max={100} step={5} className="h-9 w-full accent-primary" {...register("floatIntensity", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="szoom">Zoom level ({watch("zoom") ?? 50})</Label>
                <input id="szoom" type="range" min={0} max={100} step={5} className="h-9 w-full accent-primary" {...register("zoom", { valueAsNumber: true })} />
              </div>
            </div>

            <Controller
              control={control}
              name="isActive"
              render={({ field: f }) => (
                <label className="flex items-center justify-between text-sm">
                  Published (visible in the showcase)
                  <Switch checked={f.value} onCheckedChange={f.onChange} />
                </label>
              )}
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => setPreview(true)}>
                <Eye className="size-4" /> Live preview
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create item"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live preview */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Box className="size-4 text-primary" /> Showcase preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="overflow-hidden rounded-xl shadow-elev-2">
              <Showcase3D items={[toPreview(watch())]} />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Live preview — move your cursor over the product to feel the depth.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
