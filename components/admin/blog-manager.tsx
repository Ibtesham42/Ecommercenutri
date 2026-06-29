"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { saveBlogPost, deleteBlogPost, bulkBlogAction } from "@/lib/actions/admin/blog";
import { slugify, formatDate } from "@/lib/format";

export type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  author: string | null;
  tag: string | null;
  isPublished: boolean;
  publishedAt: string;
};

type FormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  tag: string;
  isPublished: boolean;
  publishedAt: string;
};

const BULK_ACTIONS: BulkAction[] = [
  { key: "publish", label: "Publish", icon: Eye },
  { key: "unpublish", label: "Unpublish", icon: EyeOff },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected posts?",
      description: "This permanently removes the selected blog posts. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { publish: "published", unpublish: "unpublished", delete: "deleted" };

export function BlogManager({
  posts,
  cloudinaryReady,
}: {
  posts: BlogRow[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [saving, setSaving] = useState(false);
  const sel = useBulkSelection(posts.map((p) => p.id));
  const [bulkPending, startBulk] = useTransition();

  const { register, handleSubmit, control, reset, setValue, watch } = useForm<FormValues>();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkBlogAction(sel.selectedIds, key as "publish" | "unpublish" | "delete");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function openAdd() {
    setEditing(null);
    reset({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverImage: "",
      author: "",
      tag: "",
      isPublished: true,
      publishedAt: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  }
  function openEdit(p: BlogRow) {
    setEditing(p);
    reset({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      content: p.content,
      coverImage: p.coverImage ?? "",
      author: p.author ?? "",
      tag: p.tag ?? "",
      isPublished: p.isPublished,
      publishedAt: p.publishedAt.slice(0, 10),
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveBlogPost({
      ...v,
      slug: v.slug || slugify(v.title),
      excerpt: v.excerpt || null,
      coverImage: v.coverImage || "",
      author: v.author || null,
      tag: v.tag || null,
      publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Post updated" : "Post created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onDelete(p: BlogRow) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    deleteBlogPost(p.id).then((res) => {
      if (res.ok) {
        toast.success("Post deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {posts.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({posts.length})
          </label>
        ) : (
          <span />
        )}
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> New post
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Post</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No posts yet.
                </TableCell>
              </TableRow>
            ) : (
              posts.map((p) => (
                <TableRow key={p.id} data-state={sel.isSelected(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${p.title}`}
                      checked={sel.isSelected(p.id)}
                      onCheckedChange={() => sel.toggle(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <button onClick={() => openEdit(p)} className="text-left font-medium hover:text-primary">
                      {p.title}
                    </button>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.tag ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.isPublished ? "default" : "secondary"}>
                      {p.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.publishedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" asChild aria-label="View">
                        <Link href={`/blog/${p.slug}`} target="_blank">
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(p)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BulkBar count={sel.count} actions={BULK_ACTIONS} onRun={runBulk} onClear={sel.clear} pending={bulkPending} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit post" : "New post"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="btitle">Title</Label>
                <Input
                  id="btitle"
                  {...register("title", { required: true })}
                  onBlur={(e) => {
                    if (!watch("slug")) setValue("slug", slugify(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bslug">Slug</Label>
                <Input id="bslug" {...register("slug", { required: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bexcerpt">Excerpt</Label>
              <Textarea id="bexcerpt" rows={2} {...register("excerpt")} placeholder="Short summary shown in the blog list" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bcontent">Content (HTML)</Label>
              <Textarea
                id="bcontent"
                rows={10}
                {...register("content", { required: true })}
                placeholder="<p>Write your article…</p>"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                HTML is sanitized on save. Headings, paragraphs, lists, links, images and basic
                formatting are allowed.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <Controller
                control={control}
                name="coverImage"
                render={({ field }) => (
                  <ImageUploadField value={field.value} onChange={field.onChange} cloudinaryReady={cloudinaryReady} folder="blog" />
                )}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bauthor">Author</Label>
                <Input id="bauthor" {...register("author")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="btag">Tag</Label>
                <Input id="btag" {...register("tag")} placeholder="Nutrition" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bdate">Publish date</Label>
                <Input id="bdate" type="date" {...register("publishedAt")} />
              </div>
            </div>
            <Controller
              control={control}
              name="isPublished"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Published (visible on the blog)
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
