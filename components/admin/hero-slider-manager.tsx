"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  ImageOff,
  Monitor,
  Smartphone,
  Check,
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
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import {
  HeroSlideContent,
  type HeroSlideView,
} from "@/components/storefront/hero-slider";
import { cldUrl, cldVideoPoster, isVideoUrl } from "@/lib/cld";
import {
  VIDEO_QUALITY_PROFILES,
  videoThumbCandidates,
  cldVideoVariant,
  cldVideoFrame,
  parseVideoMeta,
  formatVideoMeta,
  normalizeQuality,
  type VideoMeta,
  type VideoQualityProfile,
} from "@/lib/video";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  saveHeroSlide,
  deleteHeroSlide,
  toggleHeroSlide,
  duplicateHeroSlide,
  reorderHeroSlides,
  bulkHeroAction,
} from "@/lib/actions/admin/hero";

const BULK_ACTIONS: BulkAction[] = [
  { key: "publish", label: "Publish", icon: Eye },
  { key: "unpublish", label: "Unpublish", icon: EyeOff },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected slides?",
      description: "This permanently removes the selected hero slides. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { publish: "published", unpublish: "unpublished", delete: "deleted" };

export type HeroSlideRow = {
  id: string;
  mediaType: string;
  videoUrl: string | null;
  videoPoster: string | null;
  videoQuality: string;
  videoMeta: VideoMeta | null;
  createdAt: string;
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
  mediaType: "IMAGE" | "VIDEO";
  videoUrl: string;
  videoPoster: string;
  videoQuality: VideoQualityProfile;
  videoMeta: VideoMeta | null;
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
    mediaType: v.mediaType,
    videoUrl: v.videoUrl || null,
    videoPoster: v.videoPoster || null,
    videoQuality: v.videoQuality,
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

  const sel = useBulkSelection(order.map((s) => s.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkHeroAction(sel.selectedIds, key as "publish" | "unpublish" | "delete");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<FormValues>();
  const isVideo = watch("mediaType") === "VIDEO";
  const videoUrl = watch("videoUrl");
  const videoPoster = watch("videoPoster");
  const videoQuality = watch("videoQuality") ?? "balanced";
  const videoMeta = watch("videoMeta");

  // Video processing pipeline stages (post-upload). "Optimizing" and the two
  // "Generating" steps genuinely warm Cloudinary's on-the-fly derivations
  // (adaptive variant, poster frame, thumbnail candidates) so the first
  // storefront visitor gets a CDN hit instead of a cold transform.
  type Stage = "idle" | "uploading" | "optimizing" | "poster" | "thumbs" | "ready";
  const [stage, setStage] = useState<Stage>("idle");

  async function warmDerived(url: string) {
    const warmImage = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
      });
    setStage("optimizing");
    // Kick the middle delivery rung (a tiny ranged request triggers the transcode).
    await fetch(cldVideoVariant(url, { h: 720, quality: videoQuality, fmt: "mp4" }), {
      headers: { Range: "bytes=0-1" },
    }).catch(() => {});
    setStage("poster");
    await warmImage(cldVideoFrame(url, { h: 1080, quality: "max" }));
    setStage("thumbs");
    await Promise.all(videoThumbCandidates(url).map((t) => warmImage(t.url)));
    setStage("ready");
  }

  const STAGE_STEPS: { key: Stage; label: string }[] = [
    { key: "uploading", label: "Uploading" },
    { key: "optimizing", label: "Optimizing" },
    { key: "poster", label: "Generating poster" },
    { key: "thumbs", label: "Generating thumbnails" },
    { key: "ready", label: "Ready" },
  ];

  function openAdd() {
    setEditing(null);
    setStage("idle");
    reset({
      mediaType: "IMAGE",
      videoUrl: "",
      videoPoster: "",
      videoQuality: "balanced",
      videoMeta: null,
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
    setStage(s.mediaType === "VIDEO" && s.videoUrl ? "ready" : "idle");
    reset({
      id: s.id,
      mediaType: s.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      videoUrl: s.videoUrl ?? "",
      videoPoster: s.videoPoster ?? "",
      videoQuality: normalizeQuality(s.videoQuality),
      videoMeta: s.videoMeta,
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
      mediaType: v.mediaType,
      videoUrl: v.videoUrl || null,
      videoPoster: v.videoPoster || null,
      videoQuality: v.videoQuality || "balanced",
      videoMeta: v.videoMeta || null,
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
      <div className="mb-4 flex items-center justify-between gap-3">
        {order.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({order.length})
          </label>
        ) : (
          <span />
        )}
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
              <Checkbox
                aria-label={`Select ${s.title || "slide"}`}
                checked={sel.isSelected(s.id)}
                onCheckedChange={() => sel.toggle(s.id)}
              />
              <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
                <GripVertical className="size-5" />
              </span>
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(
                    s.mediaType === "VIDEO" && (!s.desktopImage || isVideoUrl(s.desktopImage))
                      ? cldVideoPoster(s.videoUrl ?? s.desktopImage)
                      : s.desktopImage,
                    { w: 240, h: 140, crop: "fill" },
                  )}
                  alt=""
                  className="size-full object-cover"
                />
                {s.mediaType === "VIDEO" && (
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold uppercase text-white">
                    Video
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {s.title || (s.mediaType === "VIDEO" ? "Video slide" : "Untitled slide")}
                </p>
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
                {s.mediaType === "VIDEO" && (() => {
                  const m = formatVideoMeta(s.videoMeta);
                  return (
                    <p className="truncate text-xs text-muted-foreground">
                      {m
                        ? [m.resolution, m.duration, m.size, m.codec, m.fps, m.bitrate]
                            .filter(Boolean)
                            .join(" · ")
                        : "No video details (re-upload to capture them)"}
                      {" · "}
                      <span className="text-primary">Ready</span>
                      {" · added "}
                      {formatDate(s.createdAt)}
                    </p>
                  );
                })()}
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

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      />

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit slide" : "New slide"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Registered so the toggle's value is always submitted. */}
            <input type="hidden" {...register("mediaType")} />
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
                      isVideo === (m === "VIDEO")
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
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Slide video (MP4 / WebM / MOV · max 15s)</Label>
                  <Controller
                    control={control}
                    name="videoUrl"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <ImageUploadField
                        value={field.value}
                        cloudinaryReady={cloudinaryReady}
                        folder="hero"
                        accept="video/mp4,video/webm,video/quicktime"
                        maxDurationSec={15}
                        placeholder="https://… or upload a video"
                        onChange={(url) => {
                          field.onChange(url);
                          setValue("desktopImage", url ? cldVideoPoster(url) : "");
                          setValue("videoPoster", "");
                          if (!url) {
                            setValue("videoMeta", null);
                            setStage("idle");
                          }
                        }}
                        onUploadInfo={(info) => {
                          setValue("videoMeta", parseVideoMeta(info));
                          if (info.secure_url) warmDerived(info.secure_url);
                        }}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Autoplays muted &amp; loops, fills the slide edge-to-edge (no bars, no
                    stretching — it&apos;s cover-cropped to the frame). Title, text and button
                    are hidden — the video is the full slide.
                  </p>
                </div>

                {/* Processing pipeline (post-upload). */}
                {stage !== "idle" && stage !== "uploading" && (
                  <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                    {STAGE_STEPS.slice(1).map((s, i, arr) => {
                      const activeIdx = arr.findIndex((x) => x.key === stage);
                      const done = i < activeIdx || stage === "ready";
                      const current = s.key === stage && stage !== "ready";
                      return (
                        <li key={s.key} className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-full border px-2 py-0.5",
                              done && "border-primary/40 bg-primary/10 text-primary",
                              current && "border-primary text-primary",
                              !done && !current && "text-muted-foreground",
                            )}
                          >
                            {current && <Loader2 className="size-3 animate-spin" />}
                            {done && s.key !== "ready" && <Check className="size-3" />}
                            {s.key === "ready" && stage === "ready" && <Check className="size-3" />}
                            {s.label}
                          </span>
                          {i < arr.length - 1 && <span className="text-muted-foreground/50">→</span>}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {/* Video details — everything Cloudinary told us about the upload. */}
                {videoMeta && (() => {
                  const m = formatVideoMeta(videoMeta);
                  if (!m) return null;
                  const items: [string, string | null][] = [
                    ["Resolution", m.resolution],
                    ["Aspect", m.aspect],
                    ["Duration", m.duration],
                    ["Size", m.size],
                    ["Codec", m.codec],
                    ["FPS", m.fps],
                    ["Bitrate", m.bitrate],
                    ["Uploaded", m.uploaded ? formatDate(m.uploaded) : null],
                  ];
                  return (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border bg-accent/20 p-3 text-xs sm:grid-cols-4">
                      {items
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="font-medium">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  );
                })()}

                {/* Delivery quality profile. */}
                <div className="space-y-1.5">
                  <Label>Delivery quality</Label>
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {VIDEO_QUALITY_PROFILES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setValue("videoQuality", p.value)}
                        className={cn(
                          "rounded-lg border p-2 text-left text-xs transition",
                          videoQuality === p.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-accent",
                        )}
                      >
                        <span className="block font-medium">{p.label}</span>
                        <span className="mt-0.5 block text-muted-foreground">{p.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Poster: auto frame, a picked thumbnail, or a custom upload. */}
                {videoUrl && videoUrl.includes("res.cloudinary.com") && (
                  <div className="space-y-1.5">
                    <Label>Poster (shown before the video plays)</Label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setValue("videoPoster", "")}
                        className={cn(
                          "relative h-16 w-28 overflow-hidden rounded-lg border transition",
                          !videoPoster ? "ring-2 ring-primary" : "hover:opacity-80",
                        )}
                        title="Automatic (first frame)"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cldVideoFrame(videoUrl, { at: 0, h: 360, quality: "balanced" })}
                          alt="Auto poster"
                          className="size-full object-cover"
                        />
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                          Auto
                        </span>
                      </button>
                      {videoThumbCandidates(videoUrl).slice(1).map((t) => {
                        const full = cldVideoFrame(videoUrl, { at: t.at, h: 1080, quality: "max" });
                        return (
                          <button
                            key={t.at}
                            type="button"
                            onClick={() => setValue("videoPoster", full)}
                            className={cn(
                              "h-16 w-28 overflow-hidden rounded-lg border transition",
                              videoPoster === full ? "ring-2 ring-primary" : "hover:opacity-80",
                            )}
                            title={`Frame at ${t.at.replace("p", "%")}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={t.url} alt={`Frame ${t.at}`} className="size-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                    <Controller
                      control={control}
                      name="videoPoster"
                      render={({ field }) => (
                        <ImageUploadField
                          value={field.value && !field.value.includes("/upload/so_") ? field.value : ""}
                          onChange={field.onChange}
                          cloudinaryReady={cloudinaryReady}
                          folder="hero"
                          placeholder="…or upload / paste a custom poster image"
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {!isVideo && (
              <>
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
              </>
            )}

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
