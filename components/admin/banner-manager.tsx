"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  ImageOff,
  Monitor,
  Smartphone,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { BannerCard, type BannerCardData } from "@/components/storefront/banner-card";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { BANNER_POSITIONS, BANNER_POSITION_LABELS } from "@/lib/banners";
import { cldUrl, cldVideoPoster, isVideoUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  saveBanner,
  deleteBanner,
  toggleBanner,
  duplicateBanner,
  bulkBannerAction,
} from "@/lib/actions/admin/banners";

const BULK_ACTIONS: BulkAction[] = [
  { key: "publish", label: "Publish", icon: Eye },
  { key: "unpublish", label: "Unpublish", icon: EyeOff },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected banners?",
      description: "This permanently removes the selected banners. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { publish: "published", unpublish: "unpublished", delete: "deleted" };

export type BannerRow = {
  id: string;
  mediaType: string;
  videoUrl: string | null;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  desktopImage: string;
  mobileImage: string | null;
  desktopImageDark: string | null;
  mobileImageDark: string | null;
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
  mediaType: "IMAGE" | "VIDEO";
  videoUrl: string;
  title: string;
  subtitle: string;
  description: string;
  desktopImage: string;
  mobileImage: string;
  desktopImageDark: string;
  mobileImageDark: string;
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

  const sel = useBulkSelection(banners.map((b) => b.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkBannerAction(sel.selectedIds, key as "publish" | "unpublish" | "delete");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<FormValues>();
  const values = watch();
  const isVideo = values.mediaType === "VIDEO";

  function openAdd() {
    setEditing(null);
    reset({
      mediaType: "IMAGE",
      videoUrl: "",
      title: "",
      subtitle: "",
      description: "",
      desktopImage: "",
      mobileImage: "",
      desktopImageDark: "",
      mobileImageDark: "",
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
      mediaType: b.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      videoUrl: b.videoUrl ?? "",
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      description: b.description ?? "",
      desktopImage: b.desktopImage,
      mobileImage: b.mobileImage ?? "",
      desktopImageDark: b.desktopImageDark ?? "",
      mobileImageDark: b.mobileImageDark ?? "",
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
      mediaType: v.mediaType,
      videoUrl: v.videoUrl || null,
      title: v.title || null,
      subtitle: v.subtitle || null,
      description: v.description || null,
      desktopImage: v.desktopImage,
      mobileImage: v.mobileImage || null,
      desktopImageDark: v.desktopImageDark || null,
      mobileImageDark: v.mobileImageDark || null,
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
      <div className="mb-4 flex items-center justify-between gap-3">
        {banners.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({banners.length})
          </label>
        ) : (
          <span />
        )}
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
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-xl border bg-background p-3 data-[state=selected]:border-primary/60 data-[state=selected]:ring-1 data-[state=selected]:ring-primary/30"
              data-state={sel.isSelected(b.id) ? "selected" : undefined}
            >
              <Checkbox
                aria-label={`Select ${b.title || "banner"}`}
                checked={sel.isSelected(b.id)}
                onCheckedChange={() => sel.toggle(b.id)}
              />
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(
                    b.mediaType === "VIDEO" && (!b.desktopImage || isVideoUrl(b.desktopImage))
                      ? cldVideoPoster(b.videoUrl ?? b.desktopImage)
                      : b.desktopImage,
                    { w: 240, h: 140, crop: "fill" },
                  )}
                  alt=""
                  className="size-full object-cover"
                />
                {b.mediaType === "VIDEO" && (
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold uppercase text-white">
                    Video
                  </span>
                )}
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

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Registered so the toggle's value is always submitted. */}
            <input type="hidden" {...register("mediaType")} />
            <BannerPreview values={values} />

            {/* Media type: Image (default) or Video */}
            <div>
              <Label className="mb-1.5 block">Media type</Label>
              <div className="inline-flex rounded-lg border p-0.5">
                {(["IMAGE", "VIDEO"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValue("mediaType", m)}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                      values.mediaType === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "IMAGE" ? "Image" : "Video"}
                  </button>
                ))}
              </div>
            </div>

            {isVideo && (
              <div className="space-y-1.5">
                <Label>Banner video (MP4 / WebM / MOV · max 15s)</Label>
                <Controller
                  control={control}
                  name="videoUrl"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <ImageUploadField
                      value={field.value}
                      cloudinaryReady={cloudinaryReady}
                      folder="banners"
                      accept="video/mp4,video/webm,video/quicktime"
                      maxDurationSec={15}
                      placeholder="https://… or upload a video"
                      onChange={(url) => {
                        field.onChange(url);
                        // Auto-derive a poster (Cloudinary first frame) used as the
                        // fallback image + list thumbnail; harmless for pasted URLs.
                        setValue("desktopImage", url ? cldVideoPoster(url) : "");
                      }}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Autoplays muted &amp; loops, fills the banner. Title, description and
                  button are hidden — the video is the full banner.
                </p>
              </div>
            )}

            {!isVideo && (
              <>
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
                <p className="text-xs text-muted-foreground">
                  Leave empty — a smart mobile crop is generated from the desktop image.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Dark-mode desktop (optional)</Label>
                <Controller
                  control={control}
                  name="desktopImageDark"
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="banners" />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dark-mode mobile (optional)</Label>
                <Controller
                  control={control}
                  name="mobileImageDark"
                  render={({ field }) => (
                    <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="banners" />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in dark mode. The light image is used if left empty.
                </p>
              </div>
            </div>
              </>
            )}

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

/** Live, theme/viewport-switchable preview of the banner being edited. */
function BannerPreview({ values }: { values: FormValues }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const banner: BannerCardData = {
    title: values.title || null,
    subtitle: values.subtitle || null,
    description: values.description || null,
    ctaText: values.ctaText || null,
    desktopImage: values.desktopImage || "",
    mobileImage: values.mobileImage || null,
    desktopImageDark: values.desktopImageDark || null,
    mobileImageDark: values.mobileImageDark || null,
    mediaType: values.mediaType,
    videoUrl: values.videoUrl || null,
  };
  const hasMedia = Boolean(banner.desktopImage || banner.videoUrl);

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live preview
        </span>
        <div className="flex gap-1">
          <Toggle active={viewport === "desktop"} onClick={() => setViewport("desktop")} label="Desktop">
            <Monitor className="size-4" />
          </Toggle>
          <Toggle active={viewport === "mobile"} onClick={() => setViewport("mobile")} label="Mobile">
            <Smartphone className="size-4" />
          </Toggle>
          <span className="mx-1 w-px bg-border" />
          <Toggle active={theme === "light"} onClick={() => setTheme("light")} label="Light">
            <Sun className="size-4" />
          </Toggle>
          <Toggle active={theme === "dark"} onClick={() => setTheme("dark")} label="Dark">
            <Moon className="size-4" />
          </Toggle>
        </div>
      </div>
      <div
        className={cn(
          "flex justify-center rounded-lg p-3",
          theme === "dark" ? "bg-neutral-900" : "bg-white",
        )}
      >
        {hasMedia ? (
          <div className={cn("w-full", viewport === "mobile" && "max-w-[360px]")}>
            <BannerCard banner={banner} preview={{ theme, viewport }} />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center text-sm text-muted-foreground">
            {banner.mediaType === "VIDEO" ? "Add a video to preview" : "Add a desktop image to preview"}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-7 place-items-center rounded-md border transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
