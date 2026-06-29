"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { saveStory, deleteStory, toggleStoryPublish, bulkStoryAction } from "@/lib/actions/admin/stories";

const BULK_ACTIONS: BulkAction[] = [
  { key: "publish", label: "Publish", icon: Eye },
  { key: "unpublish", label: "Unpublish", icon: EyeOff },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected stories?",
      description: "This permanently removes the selected stories. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { publish: "published", unpublish: "unpublished", delete: "deleted" };

export type StoryRow = {
  id: string;
  title: string;
  coverImage: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  productId: string | null;
  ctaText: string | null;
  isPublished: boolean;
  sortOrder: number;
  viewCount: number;
  expiresAt: string | null;
};

type FormValues = {
  id?: string;
  title: string;
  coverImage: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  productId?: string;
  ctaText?: string;
  isPublished: boolean;
  sortOrder: number;
  expiresAt?: string;
};

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function StoryManager({
  stories,
  products,
  cloudinaryReady,
}: {
  stories: StoryRow[];
  products: { id: string; name: string }[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const sel = useBulkSelection(stories.map((s) => s.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkStoryAction(sel.selectedIds, key as "publish" | "unpublish" | "delete");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  const { register, handleSubmit, control, reset } = useForm<FormValues>();

  function openAdd() {
    setEditing(null);
    reset({
      title: "",
      coverImage: "",
      mediaUrl: "",
      mediaType: "IMAGE",
      isPublished: false,
      sortOrder: 0,
    });
    setOpen(true);
  }
  function openEdit(s: StoryRow) {
    setEditing(s);
    reset({
      id: s.id,
      title: s.title,
      coverImage: s.coverImage,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      productId: s.productId ?? "",
      ctaText: s.ctaText ?? "",
      isPublished: s.isPublished,
      sortOrder: s.sortOrder,
      expiresAt: dateInput(s.expiresAt),
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveStory({
      ...v,
      productId: v.productId || null,
      ctaText: v.ctaText || null,
      sortOrder: Number(v.sortOrder) || 0,
      expiresAt: v.expiresAt || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Story updated" : "Story created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onToggle(s: StoryRow) {
    toggleStoryPublish(s.id, !s.isPublished).then((res) => {
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function onDelete(s: StoryRow) {
    if (!confirm(`Delete story "${s.title}"?`)) return;
    deleteStory(s.id).then((res) => {
      if (res.ok) {
        toast.success("Story deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {stories.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({stories.length})
          </label>
        ) : (
          <span />
        )}
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> New story
        </Button>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No stories yet. Create one to feature on the storefront.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stories.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-xl border bg-background data-[state=selected]:border-primary/60 data-[state=selected]:ring-1 data-[state=selected]:ring-primary/30"
              data-state={sel.isSelected(s.id) ? "selected" : undefined}
            >
              <div className="relative aspect-[3/4] bg-accent/30">
                {s.coverImage && (
                  <Image src={s.coverImage} alt={s.title} fill sizes="240px" className="object-cover" />
                )}
                <div className="absolute left-2 top-2 rounded bg-background/80 p-1 backdrop-blur">
                  <Checkbox
                    aria-label={`Select ${s.title}`}
                    checked={sel.isSelected(s.id)}
                    onCheckedChange={() => sel.toggle(s.id)}
                  />
                </div>
                <div className="absolute right-2 top-2">
                  <Badge variant={s.isPublished ? "default" : "secondary"}>
                    {s.isPublished ? "Live" : "Draft"}
                  </Badge>
                </div>
              </div>
              <div className="p-3">
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.viewCount} views</p>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={s.isPublished} onCheckedChange={() => onToggle(s)} />
                    Publish
                  </label>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(s)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit story" : "New story"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stitle">Title</Label>
              <Input id="stitle" {...register("title", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <Controller
                control={control}
                name="coverImage"
                rules={{ required: true }}
                render={({ field }) => (
                  <ImageUploadField
                    value={field.value}
                    onChange={field.onChange}
                    cloudinaryReady={cloudinaryReady}
                    folder="stories"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Media (image or video)</Label>
                <Controller
                  control={control}
                  name="mediaUrl"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <ImageUploadField
                      value={field.value}
                      onChange={field.onChange}
                      cloudinaryReady={cloudinaryReady}
                      folder="stories"
                      accept="image/*,video/*"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtype">Media type</Label>
                <select
                  id="smtype"
                  {...register("mediaType")}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sproduct">Linked product</Label>
                <select
                  id="sproduct"
                  {...register("productId")}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">None</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scta">CTA text</Label>
                <Input id="scta" {...register("ctaText")} placeholder="Shop now" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ssort">Sort order</Label>
                <Input id="ssort" type="number" {...register("sortOrder", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sexpires">Expires</Label>
                <Input id="sexpires" type="date" {...register("expiresAt")} />
              </div>
            </div>
            <Controller
              control={control}
              name="isPublished"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Published
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
