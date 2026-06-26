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
  Monitor,
  Smartphone,
} from "lucide-react";
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
import {
  HeroSlideContent,
  type HeroSlideView,
} from "@/components/storefront/hero-slider";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  saveHeroSlide,
  deleteHeroSlide,
  toggleHeroSlide,
  duplicateHeroSlide,
  reorderHeroSlides,
} from "@/lib/actions/admin/hero";

export type HeroSlideRow = {
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
  overlay: number;
  buttonColor: string | null;
  textAlign: string;
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
  overlay: number;
  buttonColor: string;
  textAlign: "left" | "center" | "right";
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
};

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function toPreview(v: FormValues): HeroSlideView {
  return {
    id: "preview",
    title: v.title || null,
    subtitle: v.subtitle || null,
    description: v.description || null,
    desktopImage: v.desktopImage || "https://placehold.co/2000x900/16803c/ffffff?text=Slide",
    mobileImage: v.mobileImage || null,
    ctaText: v.ctaText || null,
    overlay: Number(v.overlay) || 0,
    buttonColor: v.buttonColor || null,
    textAlign: v.textAlign,
    href: v.ctaText ? "#" : null,
  };
}

export function HeroSliderManager({
  slides,
  products,
  categories,
  cloudinaryReady,
}: {
  slides: HeroSlideRow[];
  products: Option[];
  categories: Option[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlideRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Local order for drag-and-drop; persisted on drop.
  const [order, setOrder] = useState<HeroSlideRow[]>(slides);
  const [dragId, setDragId] = useState<string | null>(null);

  // Keep local order in sync if the server data changes (after router.refresh).
  if (slides.map((s) => s.id).join() !== order.map((s) => s.id).join() && dragId === null) {
    // re-sync only when not mid-drag
    setOrder(slides);
  }

  const { register, handleSubmit, control, reset, watch } = useForm<FormValues>();

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
      overlay: 40,
      buttonColor: "",
      textAlign: "left",
      isActive: true,
      startsAt: "",
      expiresAt: "",
    });
    setOpen(true);
  }
  function openEdit(s: HeroSlideRow) {
    setEditing(s);
    reset({
      id: s.id,
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      description: s.description ?? "",
      desktopImage: s.desktopImage,
      mobileImage: s.mobileImage ?? "",
      ctaText: s.ctaText ?? "",
      ctaUrl: s.ctaUrl ?? "",
      productId: s.productId ?? "",
      categoryId: s.categoryId ?? "",
      overlay: s.overlay,
      buttonColor: s.buttonColor ?? "",
      textAlign: (s.textAlign as FormValues["textAlign"]) ?? "left",
      isActive: s.isActive,
      startsAt: dateInput(s.startsAt),
      expiresAt: dateInput(s.expiresAt),
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveHeroSlide({
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
      overlay: Number(v.overlay),
      buttonColor: v.buttonColor || null,
      textAlign: v.textAlign,
      isActive: v.isActive,
      startsAt: v.startsAt || null,
      expiresAt: v.expiresAt || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Slide updated" : "Slide created");
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

  // --- drag & drop (native HTML5) ---
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
    act(reorderHeroSlides(next.map((s) => s.id)), "Order updated");
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> Add slide
        </Button>
      </div>

      {order.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ImageOff className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No slides yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a slide to show a hero slider on the homepage (right after Stories).
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
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(s.desktopImage, { w: 240, h: 140, crop: "fill" })}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title || "Untitled slide"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.subtitle || s.ctaText || "—"}
                  {s.startsAt || s.expiresAt ? (
                    <span>
                      {" · "}
                      {s.startsAt ? `from ${formatDate(s.startsAt)}` : ""}
                      {s.expiresAt ? ` until ${formatDate(s.expiresAt)}` : ""}
                    </span>
                  ) : null}
                </p>
              </div>
              <Badge variant={s.isActive ? "default" : "secondary"}>
                {s.isActive ? "Live" : "Draft"}
              </Badge>
              <Switch
                checked={s.isActive}
                onCheckedChange={(v) => act(toggleHeroSlide(s.id, v), v ? "Published" : "Unpublished")}
                aria-label="Toggle published"
              />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => act(duplicateHeroSlide(s.id), "Slide duplicated")}
                  aria-label="Duplicate"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this slide?")) act(deleteHeroSlide(s.id), "Slide deleted");
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
            <DialogTitle>{editing ? "Edit slide" : "New slide"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="htitle">Title</Label>
                <Input id="htitle" {...register("title")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hsubtitle">Subtitle</Label>
                <Input id="hsubtitle" {...register("subtitle")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hdesc">Description</Label>
              <Textarea id="hdesc" rows={2} {...register("description")} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Desktop image</Label>
                <Controller
                  control={control}
                  name="desktopImage"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="hero" />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile image (optional)</Label>
                <Controller
                  control={control}
                  name="mobileImage"
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="hero" />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hcta">Button text</Label>
                <Input id="hcta" placeholder="Shop now" {...register("ctaText")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hctaurl">Button URL (if no product/category)</Label>
                <Input id="hctaurl" placeholder="/products or https://…" {...register("ctaUrl")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hproduct">Link to product</Label>
                <select id="hproduct" {...register("productId")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="">None</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hcategory">Link to category</Label>
                <select id="hcategory" {...register("categoryId")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="halign">Text alignment</Label>
                <select id="halign" {...register("textAlign")} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoverlay">Overlay ({watch("overlay") ?? 40}%)</Label>
                <input
                  id="hoverlay"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="h-9 w-full accent-primary"
                  {...register("overlay", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hcolor">Button color</Label>
                <Input id="hcolor" type="text" placeholder="#16803c" {...register("buttonColor")} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hstart">Publish date</Label>
                <Input id="hstart" type="date" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hexp">Expiry date</Label>
                <Input id="hexp" type="date" {...register("expiresAt")} />
              </div>
            </div>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Published (visible on the homepage)
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                  {editing ? "Save changes" : "Create slide"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live preview */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="flex-row items-center justify-between p-4 pb-0">
            <DialogTitle>Slide preview</DialogTitle>
            <div className="mr-8 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={previewDevice === "desktop" ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => setPreviewDevice("desktop")}
              >
                <Monitor className="size-4" /> Desktop
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewDevice === "mobile" ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone className="size-4" /> Mobile
              </Button>
            </div>
          </DialogHeader>
          <div className="grid place-items-center bg-muted/40 p-4">
            <div
              className={cn(
                "relative overflow-hidden rounded-xl shadow-elev-2 transition-all",
                previewDevice === "mobile" ? "h-[560px] w-[300px]" : "h-[380px] w-full",
              )}
            >
              <HeroSlideContent slide={toPreview(watch())} preview={previewDevice} />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Exactly how this slide appears on {previewDevice === "mobile" ? "phones" : "desktop"}.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
