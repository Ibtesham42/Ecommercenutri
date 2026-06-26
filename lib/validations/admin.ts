import { z } from "zod";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";

// Admins (sub-admin management by a super admin) -----------------------------

const permissionSchema = z.enum(ADMIN_PERMISSIONS);

const optionalEmail = z
  .union([z.string().email("Enter a valid email"), z.literal("")])
  .nullable()
  .optional();

export const adminCreateSchema = z.object({
  name: z.string().min(2, "Enter a name").max(80),
  email: z.string().email("Enter a valid login email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  phone: z.string().max(20).nullable().optional(),
  contactEmail: optionalEmail,
  address: z.string().max(200).nullable().optional(),
  image: z
    .union([z.string().url("Enter a valid image URL"), z.literal("")])
    .nullable()
    .optional(),
  permissions: z.array(permissionSchema).default([]),
});

export const adminUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Enter a name").max(80),
  // New password is optional on edit; blank means "leave unchanged".
  password: z
    .union([z.string().min(8, "Password must be at least 8 characters").max(100), z.literal("")])
    .optional(),
  phone: z.string().max(20).nullable().optional(),
  contactEmail: optionalEmail,
  address: z.string().max(200).nullable().optional(),
  image: z
    .union([z.string().url("Enter a valid image URL"), z.literal("")])
    .nullable()
    .optional(),
  permissions: z.array(permissionSchema).default([]),
});

// Current admin's own credentials --------------------------------------------

export const ownEmailSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const ownPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Store settings (editable contact + socials) --------------------------------

const optUrl = z
  .union([z.string().url("Enter a valid URL"), z.literal("")])
  .nullable()
  .optional();

const optImage = z
  .union([z.string().url("Enter a valid image URL"), z.literal("")])
  .nullable()
  .optional();

const optHex = z
  .union([z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex color"), z.literal("")])
  .nullable()
  .optional();

export const storeSettingsSchema = z.object({
  // Branding
  siteName: z.string().max(60).nullable().optional(),
  tagline: z.string().max(120).nullable().optional(),
  logo: optImage,
  logoDark: optImage,
  favicon: optImage,
  // Theme
  primaryColor: optHex,
  secondaryColor: optHex,
  // Announcement
  announcement: z.string().max(200).nullable().optional(),
  announcementActive: z.boolean().default(false),
  announcementLink: optUrl,
  // Contact
  supportEmail: optionalEmail,
  supportPhone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  businessHours: z.string().max(120).nullable().optional(),
  mapsEmbedUrl: optUrl,
  // Social
  instagram: optUrl,
  facebook: optUrl,
  twitter: optUrl,
  youtube: optUrl,
  // SEO
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  ogImage: optImage,
});

export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

// Hero slider (homepage CMS) -------------------------------------------------

const optionalRelId = z
  .union([z.string().min(1), z.literal("")])
  .nullable()
  .optional();

export const heroSlideSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).nullable().optional(),
  subtitle: z.string().max(160).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  desktopImage: z.string().url("Add a desktop image"),
  mobileImage: z
    .union([z.string().url("Enter a valid image URL"), z.literal("")])
    .nullable()
    .optional(),
  ctaText: z.string().max(40).nullable().optional(),
  ctaUrl: z
    .union([z.string().url("Enter a valid URL"), z.string().regex(/^\//, "Use a full URL or a path starting with /"), z.literal("")])
    .nullable()
    .optional(),
  productId: optionalRelId,
  categoryId: optionalRelId,
  overlay: z.number().int().min(0).max(100).default(40),
  buttonColor: z
    .union([z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex color"), z.literal("")])
    .nullable()
    .optional(),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type HeroSlideInput = z.infer<typeof heroSlideSchema>;

// Promotional banners --------------------------------------------------------

export const bannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).nullable().optional(),
  subtitle: z.string().max(160).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  desktopImage: z.string().url("Add a desktop image"),
  mobileImage: z
    .union([z.string().url("Enter a valid image URL"), z.literal("")])
    .nullable()
    .optional(),
  ctaText: z.string().max(40).nullable().optional(),
  ctaUrl: z
    .union([
      z.string().url("Enter a valid URL"),
      z.string().regex(/^\//, "Use a full URL or a path starting with /"),
      z.literal(""),
    ])
    .nullable()
    .optional(),
  productId: optionalRelId,
  categoryId: optionalRelId,
  position: z.string().min(1),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type BannerInput = z.infer<typeof bannerSchema>;

// Shared building blocks -----------------------------------------------------

const slug = z
  .string()
  .min(1, "Slug is required")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

/** Optional URL that also accepts an empty string / null. */
const optionalUrl = z
  .union([z.string().url("Enter a valid URL"), z.literal("")])
  .nullable()
  .optional();

const nullableString = z.string().max(4000).nullable().optional();

// Products -------------------------------------------------------------------

export const nutritionFactSchema = z.object({
  label: z.string().min(1, "Label").max(40),
  value: z.string().min(1, "Value").max(40),
});

export const variantInputSchema = z
  .object({
    id: z.string().optional(),
    weightLabel: z.string().min(1, "Label required").max(40),
    weightInGrams: z.number().int().nonnegative().nullable().optional(),
    price: z.number().int().min(1, "Price required"), // paise
    discountPrice: z.number().int().min(0).nullable().optional(), // paise
    stock: z.number().int().min(0),
    sku: z.string().max(60).nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((v) => !v.discountPrice || v.discountPrice < v.price, {
    message: "Discount must be below price",
    path: ["discountPrice"],
  });

export const imageInputSchema = z.object({
  id: z.string().optional(),
  url: z.string().url("Enter a valid image URL"),
  alt: z.string().max(160).nullable().optional(),
  isMain: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const productInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is too short").max(120),
  slug,
  sku: z.string().max(60).nullable().optional(),
  shortDescription: z.string().max(200).nullable().optional(),
  description: z.string().min(1, "Description is required"),
  benefits: nullableString,
  ingredients: nullableString,
  categoryId: z.string().min(1, "Select a category"),
  brandId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  nutritionFacts: z.array(nutritionFactSchema).default([]),
  variants: z.array(variantInputSchema).min(1, "Add at least one variant"),
  images: z.array(imageInputSchema).default([]),
});

// Categories -----------------------------------------------------------------

export const categoryInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is too short").max(80),
  slug,
  description: z.string().max(300).nullable().optional(),
  image: optionalUrl,
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
});

// Coupons --------------------------------------------------------------------

export const couponInputSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .min(3, "Code is too short")
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Use A–Z, 0–9, - or _"),
    description: z.string().max(160).nullable().optional(),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().min(1, "Enter a value"), // percent 1–100, or paise
    minOrder: z.number().int().min(0).nullable().optional(), // paise
    maxDiscount: z.number().int().min(0).nullable().optional(), // paise
    usageLimit: z.number().int().min(0).nullable().optional(),
    perUserLimit: z.number().int().min(0).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || (c.value >= 1 && c.value <= 100), {
    message: "Percentage must be between 1 and 100",
    path: ["value"],
  });

// Stories --------------------------------------------------------------------

export const storyInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Title is too short").max(80),
  coverImage: z.string().url("Enter a valid cover image URL"),
  mediaUrl: z.string().url("Enter a valid media URL"),
  mediaType: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  productId: z.string().nullable().optional(),
  ctaText: z.string().max(40).nullable().optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  expiresAt: z.coerce.date().nullable().optional(),
});

// AI settings ----------------------------------------------------------------

export const aiSettingSchema = z.object({
  model: z.string().min(1, "Model is required").max(80),
  isEnabled: z.boolean(),
  assistantEnabled: z.boolean(),
  searchEnabled: z.boolean(),
  productAssistantEnabled: z.boolean(),
  systemPrompt: z.string().max(4000).nullable().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
});

// Orders ---------------------------------------------------------------------

export const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
});

// Inferred types -------------------------------------------------------------

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
export type StoryInput = z.infer<typeof storyInputSchema>;
export type AISettingInput = z.infer<typeof aiSettingSchema>;
