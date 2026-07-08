"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller, type FieldPath } from "react-hook-form";
import {
  Plus,
  Trash2,
  Loader2,
  Star,
  ImageIcon,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Copy,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { MultiImageDrop } from "@/components/admin/multi-image-drop";
import { saveProduct } from "@/lib/actions/admin/products";
import { rupeesToPaise, slugify } from "@/lib/format";
import type { ProductFormValues } from "@/lib/admin/product-form-values";

type Option = { id: string; name: string };

export type { ProductFormValues } from "@/lib/admin/product-form-values";

const emptyVariant = (): ProductFormValues["variants"][number] => ({
  weightLabel: "",
  weightInGrams: null,
  priceRupees: 0,
  discountRupees: null,
  stock: 0,
  sku: "",
  isActive: true,
  isDefault: false,
  images: [],
  description: "",
  barcode: "",
  badge: "",
  nutritionImageUrl: "",
});

const BADGE_SUGGESTIONS = ["Best Seller", "New", "Limited", "Value Pack", "Family Pack"];

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
  // Suppresses the unsaved-changes prompt once we navigate away after a save.
  const savedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    defaultValues: initial ?? {
      name: "",
      slug: "",
      description: "",
      categoryId: "",
      isActive: true,
      isFeatured: false,
      isBestSeller: false,
      returnable: true,
      nutritionFacts: [],
      variants: [{ ...emptyVariant(), isDefault: true }],
      images: [],
    },
  });

  const variants = useFieldArray({ control, name: "variants" });
  const images = useFieldArray({ control, name: "images" });
  const facts = useFieldArray({ control, name: "nutritionFacts" });

  // Warn before losing unsaved edits on tab close / refresh / external nav —
  // standard for a premium seller admin. In-app Cancel is guarded separately.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // ⌘/Ctrl+S saves — a small productivity nicety for power sellers.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
  // Integer variants — counts/days/grams can't be fractional, so round a stray
  // decimal instead of rejecting it (e.g. stock "10.5" → 10).
  const int = (v: unknown): number => Math.round(num(v));
  const optInt = (v: unknown): number | null => {
    const n = optNum(v);
    return n == null ? null : Math.round(n);
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
      returnable: values.returnable,
      returnWindowDays: optInt(values.returnWindowDays),
      gstRate: optInt(values.gstRate),
      deliveryCharge: (() => {
        const d = optNum(values.deliveryRupees);
        return d != null ? rupeesToPaise(d) : null;
      })(),
      metaTitle: values.metaTitle || null,
      metaDescription: values.metaDescription || null,
      nutritionFacts: values.nutritionFacts.filter((f) => f.label && f.value),
      variants: values.variants.map((v) => {
        const discount = optNum(v.discountRupees);
        return {
          id: v.id,
          weightLabel: v.weightLabel,
          weightInGrams: optInt(v.weightInGrams),
          price: rupeesToPaise(num(v.priceRupees)),
          discountPrice: discount != null ? rupeesToPaise(discount) : null,
          stock: int(v.stock),
          sku: v.sku || null,
          isActive: v.isActive,
          isDefault: v.isDefault,
          images: (v.images ?? []).filter(Boolean),
          description: v.description || null,
          barcode: v.barcode || null,
          badge: v.badge || null,
          nutritionImageUrl: v.nutritionImageUrl || null,
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

    if (process.env.NODE_ENV !== "production") {
      console.debug("[product-form] submitting payload", payload);
    }
    const res = await saveProduct(payload);
    setSaving(false);
    if (res.ok) {
      toast.success(values.id ? "Product updated" : "Product created");
      savedRef.current = true; // don't warn on the programmatic navigation
      router.push("/admin/products");
      router.refresh();
    } else {
      toast.error(res.error);
      // Highlight the exact offending field (inline) and scroll to it.
      if (res.field) {
        setError(res.field as FieldPath<ProductFormValues>, {
          type: "server",
          message: res.error,
        });
        focusField(res.field);
      }
    }
  }

  /** Scroll to + focus a form control by its RHF field name (or id fallback). */
  function focusField(name: string) {
    if (typeof document === "undefined") return;
    const el =
      document.querySelector<HTMLElement>(`[name="${name}"]`) ??
      document.querySelector<HTMLElement>(`[id="${name}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }

  // Never let a blocked submit fail silently — point the admin at what's missing
  // and scroll to the first offending field.
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
    // Scroll to the first field with an error.
    const first =
      (errors.name && "name") ||
      (errors.slug && "slug") ||
      (errors.description && "description") ||
      (errors.categoryId && "categoryId") ||
      (errors.variants && "variants.0.weightLabel") ||
      "";
    if (first) focusField(first);
  }

  function makeDefaultVariant(index: number) {
    watch("variants").forEach((_, i) => setValue(`variants.${i}.isDefault`, i === index));
  }
  function makeMainImage(index: number) {
    watch("images").forEach((_, i) => setValue(`images.${i}.isMain`, i === index));
  }

  // Per-variant "Media & details" disclosure, keyed by field id so the open
  // state survives add/remove of sibling variants.
  const [openMedia, setOpenMedia] = useState<Record<string, boolean>>({});
  // Native HTML5 drag-reorder (hero-manager pattern): the grip is the drag
  // source, the row is the drop target. Arrows remain the keyboard path.
  const [dragImage, setDragImage] = useState<number | null>(null);
  const [dragPhoto, setDragPhoto] = useState<{ v: number; j: number } | null>(null);
  const variantImages = (i: number): string[] => watch(`variants.${i}.images`) ?? [];
  const setVariantImages = (i: number, imgs: string[]) =>
    setValue(`variants.${i}.images`, imgs, { shouldDirty: true });
  const moveVariantImage = (i: number, from: number, to: number) => {
    const imgs = [...variantImages(i)];
    if (to < 0 || to >= imgs.length) return;
    const [img] = imgs.splice(from, 1);
    imgs.splice(to, 0, img);
    setVariantImages(i, imgs);
  };

  const sectionClass = "rounded-xl border bg-background p-5 space-y-4";

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
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
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message ?? "Name is required."}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" {...register("slug", { required: true })} />
                {errors.slug && (
                  <p className="text-xs text-destructive">{errors.slug.message ?? "Slug is required."}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU (optional)</Label>
                <Input id="sku" {...register("sku")} />
                {errors.sku && (
                  <p className="text-xs text-destructive">{errors.sku.message}</p>
                )}
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
                <p className="text-xs text-destructive">{errors.description.message ?? "Description is required."}</p>
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
                        <p className="text-xs text-destructive">{errors.variants[i]?.weightLabel?.message ?? "Required"}</p>
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
                        <p className="text-xs text-destructive">{errors.variants[i]?.priceRupees?.message ?? "Enter a price"}</p>
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
                      {errors.variants?.[i]?.stock && (
                        <p className="text-xs text-destructive">{errors.variants[i]?.stock?.message ?? "Invalid stock"}</p>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => {
                          // Copy everything except identity: fresh row, blank
                          // label (validation nudges the admin to set it) and
                          // blank SKU (unique), never default.
                          const v = watch(`variants.${i}`);
                          variants.append({
                            ...v,
                            id: undefined,
                            weightLabel: "",
                            sku: "",
                            isDefault: false,
                            images: [...(v.images ?? [])],
                          });
                        }}
                        aria-label="Duplicate variant"
                      >
                        <Copy className="size-4" />
                      </Button>
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
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMedia((s) => ({ ...s, [field.id]: !s[field.id] }))
                      }
                      className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform",
                          openMedia[field.id] && "rotate-180",
                        )}
                      />
                      {openMedia[field.id]
                        ? "Hide media & details"
                        : `Media & details${
                            variantImages(i).length > 0
                              ? ` · ${variantImages(i).length} photo${variantImages(i).length > 1 ? "s" : ""}`
                              : ""
                          }`}
                    </button>
                  </div>

                  {openMedia[field.id] && (
                    <div className="mt-3 space-y-4 border-t pt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">SKU (optional)</Label>
                          <Input placeholder="NUT-MAK-250" {...register(`variants.${i}.sku`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Barcode (optional)</Label>
                          <Input placeholder="EAN / UPC" {...register(`variants.${i}.barcode`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Badge (optional)</Label>
                          <Input
                            list="variant-badges"
                            placeholder="Best Seller"
                            {...register(`variants.${i}.badge`)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Variant description (optional)</Label>
                        <Textarea
                          rows={3}
                          placeholder="Leave blank to use the product description"
                          {...register(`variants.${i}.description`)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Variant photos</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setVariantImages(i, [...variantImages(i), ""])}
                          >
                            <Plus className="size-3.5" /> Add photo
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Shown when this variant is selected — leave empty to use the
                          product gallery. The first photo is the cover.
                        </p>
                        <MultiImageDrop
                          cloudinaryReady={cloudinaryReady}
                          folder="products"
                          label="Drop variant photos here, or browse"
                          onUploaded={(urls) =>
                            setVariantImages(i, [...variantImages(i), ...urls])
                          }
                        />
                        {variantImages(i).map((url, j) => (
                          <div
                            key={`${field.id}-img-${j}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragPhoto && dragPhoto.v === i && dragPhoto.j !== j) {
                                moveVariantImage(i, dragPhoto.j, j);
                              }
                              setDragPhoto(null);
                            }}
                            className={cn(
                              "rounded-lg border p-2.5 transition-opacity",
                              dragPhoto?.v === i && dragPhoto.j === j && "opacity-50",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                draggable
                                onDragStart={() => setDragPhoto({ v: i, j })}
                                onDragEnd={() => setDragPhoto(null)}
                                className="mt-2.5 cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <ImageUploadField
                                  value={url}
                                  onChange={(u) => {
                                    const next = [...variantImages(i)];
                                    next[j] = u;
                                    setVariantImages(i, next);
                                  }}
                                  cloudinaryReady={cloudinaryReady}
                                  folder="products"
                                />
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              {j === 0 ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  Cover
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => moveVariantImage(i, j, 0)}
                                  className="text-xs text-muted-foreground hover:text-primary"
                                >
                                  Make cover
                                </button>
                              )}
                              <div className="ml-auto flex items-center">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground"
                                  onClick={() => moveVariantImage(i, j, j - 1)}
                                  disabled={j === 0}
                                  aria-label="Move photo up"
                                >
                                  <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground"
                                  onClick={() => moveVariantImage(i, j, j + 1)}
                                  disabled={j === variantImages(i).length - 1}
                                  aria-label="Move photo down"
                                >
                                  <ArrowDown className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    setVariantImages(
                                      i,
                                      variantImages(i).filter((_, k) => k !== j),
                                    )
                                  }
                                  aria-label="Remove photo"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Nutrition image (optional)</Label>
                        <Controller
                          control={control}
                          name={`variants.${i}.nutritionImageUrl`}
                          render={({ field: f }) => (
                            <ImageUploadField
                              value={f.value ?? ""}
                              onChange={f.onChange}
                              cloudinaryReady={cloudinaryReady}
                              folder="products"
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <datalist id="variant-badges">
              {BADGE_SUGGESTIONS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
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
            <MultiImageDrop
              cloudinaryReady={cloudinaryReady}
              folder="products"
              onUploaded={(urls) => {
                const startEmpty = images.fields.length === 0;
                urls.forEach((url, k) =>
                  images.append({ url, alt: "", isMain: startEmpty && k === 0 }),
                );
              }}
            />
            {images.fields.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-4" />
                {cloudinaryReady
                  ? "Drop several photos above, or add URL rows below."
                  : "Paste image URLs (add Cloudinary keys to enable uploads)."}
              </p>
            ) : (
              <div className="space-y-3">
                {images.fields.map((field, i) => (
                  <div
                    key={field.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragImage != null && dragImage !== i) images.move(dragImage, i);
                      setDragImage(null);
                    }}
                    className={cn(
                      "rounded-lg border p-3 transition-opacity",
                      dragImage === i && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        draggable
                        onDragStart={() => setDragImage(i)}
                        onDragEnd={() => setDragImage(null)}
                        className="mt-2.5 cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
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
                      </div>
                    </div>
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
                <p className="text-xs text-destructive">{errors.categoryId.message ?? "Pick a category."}</p>
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
            <h2 className="font-semibold">Tax &amp; shipping</h2>
            <p className="text-xs text-muted-foreground">
              Leave blank to use the store defaults (set in Appearance → Pricing).
              Prices are treated as inclusive of GST.
            </p>
            <Controller
              control={control}
              name="gstRate"
              render={({ field: f }) => (
                <div className="space-y-1.5">
                  <Label htmlFor="gstRate">GST rate (%)</Label>
                  <Input
                    id="gstRate"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={0}
                    max={100}
                    placeholder="Store default"
                    value={f.value ?? ""}
                    onChange={(e) =>
                      f.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => f.onChange(rate)}
                        className={`rounded-md border px-2 py-0.5 text-xs transition ${
                          f.value === rate
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                  {errors.gstRate && (
                    <p className="text-xs text-destructive">{errors.gstRate.message ?? "Enter a whole number."}</p>
                  )}
                </div>
              )}
            />
            <Controller
              control={control}
              name="deliveryRupees"
              render={({ field: f }) => (
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryCharge">Delivery charge (₹)</Label>
                  <Input
                    id="deliveryCharge"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="Store default"
                    value={f.value ?? ""}
                    onChange={(e) =>
                      f.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Set ₹0 for free delivery on this product.
                  </p>
                </div>
              )}
            />
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Visibility</h2>
            {(
              [
                ["isActive", "Active"],
                ["isFeatured", "Featured"],
                ["isBestSeller", "Best seller"],
                ["returnable", "Returnable"],
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
            <Controller
              control={control}
              name="returnWindowDays"
              render={({ field: f }) => (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="returnWindowDays">Return window override (days)</Label>
                  <Input
                    id="returnWindowDays"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    placeholder="Store default"
                    value={f.value ?? ""}
                    onChange={(e) =>
                      f.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the store default. Only applies when returnable.
                  </p>
                </div>
              )}
            />
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

      <div className="flex items-center justify-end gap-3">
        {isDirty && !saving && (
          <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (
              isDirty &&
              !window.confirm("Discard your unsaved changes?")
            )
              return;
            router.back();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="gap-2" title="Save (⌘/Ctrl+S)">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}

