"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2, Loader2, Star, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { saveProduct } from "@/lib/actions/admin/products";
import { rupeesToPaise, paiseToRupees, slugify } from "@/lib/format";

type Option = { id: string; name: string };

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku?: string;
  shortDescription?: string;
  description: string;
  benefits?: string;
  ingredients?: string;
  categoryId: string;
  brandId?: string;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  metaTitle?: string;
  metaDescription?: string;
  nutritionFacts: { label: string; value: string }[];
  variants: {
    id?: string;
    weightLabel: string;
    weightInGrams?: number | null;
    priceRupees: number;
    discountRupees?: number | null;
    stock: number;
    sku?: string;
    isActive: boolean;
    isDefault: boolean;
  }[];
  images: { id?: string; url: string; alt?: string; isMain: boolean }[];
};

const emptyVariant = (): ProductFormValues["variants"][number] => ({
  weightLabel: "",
  weightInGrams: null,
  priceRupees: 0,
  discountRupees: null,
  stock: 0,
  sku: "",
  isActive: true,
  isDefault: false,
});

export function ProductForm({
  categories,
  brands,
  initial,
  cloudinaryReady,
}: {
  categories: Option[];
  brands: Option[];
  initial?: ProductFormValues;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    defaultValues: initial ?? {
      name: "",
      slug: "",
      description: "",
      categoryId: "",
      isActive: true,
      isFeatured: false,
      isBestSeller: false,
      nutritionFacts: [],
      variants: [{ ...emptyVariant(), isDefault: true }],
      images: [],
    },
  });

  const variants = useFieldArray({ control, name: "variants" });
  const images = useFieldArray({ control, name: "images" });
  const facts = useFieldArray({ control, name: "nutritionFacts" });

  // Empty numeric inputs come back as NaN (react-hook-form `valueAsNumber`);
  // coerce to a finite number so the server never sees NaN (which fails Zod with
  // a cryptic "expected number, received NaN").
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const optNum = (v: unknown): number | null => {
    const n = Number(v);
    return v != null && v !== "" && Number.isFinite(n) ? n : null;
  };

  async function onSubmit(values: ProductFormValues) {
    setSaving(true);
    const payload = {
      id: values.id,
      name: values.name,
      slug: values.slug || slugify(values.name),
      sku: values.sku || null,
      shortDescription: values.shortDescription || null,
      description: values.description,
      benefits: values.benefits || null,
      ingredients: values.ingredients || null,
      categoryId: values.categoryId,
      brandId: values.brandId || null,
      isActive: values.isActive,
      isFeatured: values.isFeatured,
      isBestSeller: values.isBestSeller,
      metaTitle: values.metaTitle || null,
      metaDescription: values.metaDescription || null,
      nutritionFacts: values.nutritionFacts.filter((f) => f.label && f.value),
      variants: values.variants.map((v) => {
        const discount = optNum(v.discountRupees);
        return {
          id: v.id,
          weightLabel: v.weightLabel,
          weightInGrams: optNum(v.weightInGrams),
          price: rupeesToPaise(num(v.priceRupees)),
          discountPrice: discount != null ? rupeesToPaise(discount) : null,
          stock: num(v.stock),
          sku: v.sku || null,
          isActive: v.isActive,
          isDefault: v.isDefault,
        };
      }),
      images: values.images.map((im, i) => ({
        id: im.id,
        url: im.url,
        alt: im.alt || null,
        isMain: im.isMain,
        sortOrder: i,
      })),
    };

    const res = await saveProduct(payload);
    setSaving(false);
    if (res.ok) {
      toast.success(values.id ? "Product updated" : "Product created");
      router.push("/admin/products");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  // Never let a blocked submit fail silently — point the admin at what's missing.
  function onInvalid() {
    const missing: string[] = [];
    if (errors.name) missing.push("name");
    if (errors.slug) missing.push("slug");
    if (errors.description) missing.push("description");
    if (errors.categoryId) missing.push("category");
    if (errors.variants) missing.push("each variant's label & price");
    if (errors.images) missing.push("image URLs");
    toast.error(
      missing.length
        ? `Please complete: ${missing.join(", ")}.`
        : "Please complete the highlighted fields before saving.",
    );
  }

  function makeDefaultVariant(index: number) {
    watch("variants").forEach((_, i) => setValue(`variants.${i}.isDefault`, i === index));
  }
  function makeMainImage(index: number) {
    watch("images").forEach((_, i) => setValue(`images.${i}.isMain`, i === index));
  }

  const sectionClass = "rounded-xl border bg-background p-5 space-y-4";

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Basics */}
          <div className={sectionClass}>
            <h2 className="font-semibold">Details</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...register("name", { required: true })}
                onBlur={(e) => {
                  if (!watch("slug")) setValue("slug", slugify(e.target.value));
                }}
              />
              {errors.name && <p className="text-xs text-destructive">Name is required.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" {...register("slug", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU (optional)</Label>
                <Input id="sku" {...register("sku")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortDescription">Short description</Label>
              <Input id="shortDescription" {...register("shortDescription")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} {...register("description", { required: true })} />
              {errors.description && (
                <p className="text-xs text-destructive">Description is required.</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="benefits">Benefits</Label>
                <Textarea id="benefits" rows={3} {...register("benefits")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredients">Ingredients</Label>
                <Textarea id="ingredients" rows={3} {...register("ingredients")} />
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Variants &amp; pricing</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => variants.append(emptyVariant())}
              >
                <Plus className="size-4" /> Add variant
              </Button>
            </div>
            <div className="space-y-3">
              {variants.fields.map((field, i) => (
                <div key={field.id} className="rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_80px_auto]">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        placeholder="250g"
                        {...register(`variants.${i}.weightLabel`, { required: true })}
                      />
                      {errors.variants?.[i]?.weightLabel && (
                        <p className="text-xs text-destructive">Required</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`variants.${i}.priceRupees`, {
                          required: true,
                          valueAsNumber: true,
                          min: 0.01,
                        })}
                      />
                      {errors.variants?.[i]?.priceRupees && (
                        <p className="text-xs text-destructive">Enter a price</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sale (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`variants.${i}.discountRupees`, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stock</Label>
                      <Input
                        type="number"
                        {...register(`variants.${i}.stock`, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => variants.remove(i)}
                        disabled={variants.fields.length <= 1}
                        aria-label="Remove variant"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => makeDefaultVariant(i)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                    >
                      <Star
                        className={
                          watch(`variants.${i}.isDefault`)
                            ? "size-4 fill-primary text-primary"
                            : "size-4"
                        }
                      />
                      Default
                    </button>
                    <Controller
                      control={control}
                      name={`variants.${i}.isActive`}
                      render={({ field: f }) => (
                        <label className="flex items-center gap-2 text-muted-foreground">
                          <Switch checked={f.value} onCheckedChange={f.onChange} />
                          Active
                        </label>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Images</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => images.append({ url: "", alt: "", isMain: images.fields.length === 0 })}
              >
                <Plus className="size-4" /> Add image
              </Button>
            </div>
            {images.fields.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-4" />
                {cloudinaryReady
                  ? "Upload images or paste URLs."
                  : "Paste image URLs (add Cloudinary keys to enable uploads)."}
              </p>
            ) : (
              <div className="space-y-3">
                {images.fields.map((field, i) => (
                  <div key={field.id} className="rounded-lg border p-3">
                    <Controller
                      control={control}
                      name={`images.${i}.url`}
                      rules={{ required: true }}
                      render={({ field: f }) => (
                        <ImageUploadField
                          value={f.value}
                          onChange={f.onChange}
                          cloudinaryReady={cloudinaryReady}
                          folder="products"
                        />
                      )}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        placeholder="Alt text"
                        {...register(`images.${i}.alt`)}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => makeMainImage(i)}
                        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        aria-label="Set as main image"
                      >
                        <Star
                          className={
                            watch(`images.${i}.isMain`)
                              ? "size-4 fill-primary text-primary"
                              : "size-4"
                          }
                        />
                        Main
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => images.remove(i)}
                        aria-label="Remove image"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nutrition */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Nutrition facts</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => facts.append({ label: "", value: "" })}
              >
                <Plus className="size-4" /> Add row
              </Button>
            </div>
            {facts.fields.length > 0 && (
              <div className="space-y-2">
                {facts.fields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input placeholder="Protein" {...register(`nutritionFacts.${i}.label`)} />
                    <Input placeholder="9.7 g" {...register(`nutritionFacts.${i}.value`)} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => facts.remove(i)}
                      aria-label="Remove row"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className={sectionClass}>
            <h2 className="font-semibold">Organization</h2>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                control={control}
                name="categoryId"
                rules={{ required: true }}
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && (
                <p className="text-xs text-destructive">Pick a category.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Brand (optional)</Label>
              <Controller
                control={control}
                name="brandId"
                render={({ field: f }) => (
                  <Select value={f.value ?? ""} onValueChange={f.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="No brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Visibility</h2>
            {(
              [
                ["isActive", "Active"],
                ["isFeatured", "Featured"],
                ["isBestSeller", "Best seller"],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field: f }) => (
                  <label className="flex items-center justify-between text-sm">
                    {label}
                    <Switch checked={f.value} onCheckedChange={f.onChange} />
                  </label>
                )}
              />
            ))}
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">SEO</h2>
            <div className="space-y-1.5">
              <Label htmlFor="metaTitle">Meta title</Label>
              <Input id="metaTitle" {...register("metaTitle")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metaDescription">Meta description</Label>
              <Textarea id="metaDescription" rows={3} {...register("metaDescription")} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}

/** Build form defaults from a persisted product (paise → rupees). */
export function productToFormValues(p: {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string;
  benefits: string | null;
  ingredients: string | null;
  categoryId: string;
  brandId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  nutritionFacts: unknown;
  variants: {
    id: string;
    weightLabel: string;
    weightInGrams: number | null;
    price: number;
    discountPrice: number | null;
    stock: number;
    sku: string | null;
    isActive: boolean;
    isDefault: boolean;
  }[];
  images: { id: string; url: string; alt: string | null; isMain: boolean }[];
}): ProductFormValues {
  const nf = Array.isArray(p.nutritionFacts)
    ? (p.nutritionFacts as { label: string; value: string }[])
    : [];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? "",
    shortDescription: p.shortDescription ?? "",
    description: p.description,
    benefits: p.benefits ?? "",
    ingredients: p.ingredients ?? "",
    categoryId: p.categoryId,
    brandId: p.brandId ?? "",
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    nutritionFacts: nf,
    variants: p.variants.map((v) => ({
      id: v.id,
      weightLabel: v.weightLabel,
      weightInGrams: v.weightInGrams,
      priceRupees: paiseToRupees(v.price),
      discountRupees: v.discountPrice ? paiseToRupees(v.discountPrice) : null,
      stock: v.stock,
      sku: v.sku ?? "",
      isActive: v.isActive,
      isDefault: v.isDefault,
    })),
    images: p.images.map((im) => ({
      id: im.id,
      url: im.url,
      alt: im.alt ?? "",
      isMain: im.isMain,
    })),
  };
}
