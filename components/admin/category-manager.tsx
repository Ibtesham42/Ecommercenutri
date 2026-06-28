"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { saveCategory, deleteCategory } from "@/lib/actions/admin/categories";
import { slugify } from "@/lib/format";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  returnable: boolean;
  productCount: number;
  parentName: string | null;
};

type FormValues = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  returnable: boolean;
  metaTitle?: string;
  metaDescription?: string;
};

export function CategoryManager({
  categories,
  cloudinaryReady,
}: {
  categories: CategoryRow[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, reset, setValue, watch } =
    useForm<FormValues>();

  function openAdd() {
    setEditing(null);
    reset({ name: "", slug: "", sortOrder: 0, isActive: true, returnable: true, parentId: "" });
    setOpen(true);
  }
  function openEdit(c: CategoryRow) {
    setEditing(c);
    reset({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      image: c.image ?? "",
      parentId: c.parentId ?? "",
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      returnable: c.returnable,
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const res = await saveCategory({
      ...values,
      slug: values.slug || slugify(values.name),
      parentId: values.parentId || null,
      sortOrder: Number(values.sortOrder) || 0,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(values.id ? "Category updated" : "Category created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onDelete(c: CategoryRow) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    deleteCategory(c.id).then((res) => {
      if (res.ok) {
        toast.success("Category deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> New category
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{c.parentName ?? "—"}</TableCell>
                  <TableCell>{c.productCount}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(c)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cname">Name</Label>
                <Input
                  id="cname"
                  {...register("name", { required: true })}
                  onBlur={(e) => {
                    if (!watch("slug")) setValue("slug", slugify(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cslug">Slug</Label>
                <Input id="cslug" {...register("slug", { required: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdesc">Description</Label>
              <Textarea id="cdesc" rows={2} {...register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>Image</Label>
              <Controller
                control={control}
                name="image"
                render={({ field }) => (
                  <ImageUploadField
                    value={field.value}
                    onChange={field.onChange}
                    cloudinaryReady={cloudinaryReady}
                    folder="categories"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cparent">Parent</Label>
                <select
                  id="cparent"
                  {...register("parentId")}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">None (top level)</option>
                  {categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="csort">Sort order</Label>
                <Input id="csort" type="number" {...register("sortOrder", { valueAsNumber: true })} />
              </div>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Active (visible in store)
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              control={control}
              name="returnable"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Returnable (products in this category can be returned)
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
