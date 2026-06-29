import { z } from "zod";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import { isShowcaseAnimation, isShowcaseBackground } from "@/lib/showcase";

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

/** True for "" or a valid http(s) URL (incl. Cloudinary links). */
function isBlankOrHttpUrl(v: string): boolean {
  if (v === "") return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Optional link/image field: trims whitespace (pasted/uploaded URLs often carry a
 * trailing newline that `.url()` would reject), treats null/blank as empty, and on a
 * bad value returns a clear, field-named message — not Zod's generic "Invalid input".
 */
const optUrl = (label = "Link") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v == null ? "" : v),
    z
      .string()
      .refine(isBlankOrHttpUrl, { message: `${label} must be a valid link (https://…) or left blank` })
      .optional(),
  );

const optImage = (label = "Image") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v == null ? "" : v),
    z
      .string()
      .refine(isBlankOrHttpUrl, { message: `${label} must be a valid image URL or left blank` })
      .optional(),
  );

const optHex = z
  .union([z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex color"), z.literal("")])
  .nullable()
  .optional();

/** Optional pixel size: a positive int within range, or blank (→ null). */
const optPx = (min: number, max: number) =>
  z.preprocess(
    (v) =>
      v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v,
    z.coerce.number().int().min(min, `Min ${min}px`).max(max, `Max ${max}px`).optional(),
  );

/** Optional non-negative integer within range, or blank (→ undefined). */
const optInt = (min: number, max: number, label = "Value") =>
  z.preprocess(
    (v) =>
      v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v,
    z.coerce.number().int().min(min, `${label} min ${min}`).max(max, `${label} max ${max}`).optional(),
  );

export const storeSettingsSchema = z.object({
  // Branding
  siteName: z.string().max(60).nullable().optional(),
  tagline: z.string().max(120).nullable().optional(),
  logo: optImage("Logo"),
  logoDark: optImage("Dark logo"),
  favicon: optImage("Favicon"),
  // Logo size (px)
  logoHeight: optPx(16, 64),
  logoHeightMobile: optPx(16, 64),
  logoMaxWidth: optPx(60, 400),
  // Theme
  primaryColor: optHex,
  secondaryColor: optHex,
  // Announcement
  announcement: z.string().max(200).nullable().optional(),
  announcementActive: z.boolean().default(false),
  announcementLink: optUrl("Announcement link"),
  // Tax / GST (shipping lives in shippingSettingsSchema → /admin/shipping)
  defaultGstRate: optInt(0, 100, "GST %"),
  gstin: z.string().max(20).nullable().optional(),
  // Contact
  supportEmail: optionalEmail,
  supportPhone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  businessHours: z.string().max(120).nullable().optional(),
  mapsEmbedUrl: optUrl("Google Maps URL"),
  // Social
  instagram: optUrl("Instagram URL"),
  facebook: optUrl("Facebook URL"),
  twitter: optUrl("Twitter/X URL"),
  youtube: optUrl("YouTube URL"),
  // SEO
  metaTitle: z.string().max(120, "Default meta title is too long (max 120 characters)").nullable().optional(),
  metaDescription: z.string().max(320, "Default meta description is too long (max 320 characters)").nullable().optional(),
  ogImage: optImage("Default social share image"),
});

export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

// Shipping & delivery (single source of truth — /admin/shipping). Fees are paise;
// the form converts rupees → paise before submit.
export const shippingSettingsSchema = z
  .object({
    defaultShippingFee: optInt(0, 10_000_00, "Default delivery"),
    freeShippingThreshold: optInt(0, 1_000_000_00, "Free-delivery threshold"),
    freeShippingEnabled: z.boolean().default(true),
    localDeliveryFee: optInt(0, 10_000_00, "Local delivery"),
    expressDeliveryFee: optInt(0, 10_000_00, "Express delivery"),
    // Cash on Delivery
    codEnabled: z.boolean().default(false),
    codFee: optInt(0, 10_000_00, "COD charge"),
    codMinOrder: optInt(0, 1_000_000_00, "COD min order"),
    codMaxOrder: optInt(0, 1_000_000_00, "COD max order"),
    // Returns & refunds
    returnsEnabled: z.boolean().default(true),
    returnWindowDays: z.coerce.number().int().min(0).max(365).default(7),
  })
  .refine(
    (d) => d.codMinOrder == null || d.codMaxOrder == null || d.codMaxOrder >= d.codMinOrder,
    { message: "COD max must be ≥ COD min", path: ["codMaxOrder"] },
  );

export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;

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

// 3D hero showcase -----------------------------------------------------------

export const showcaseItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Add a title").max(80),
  tagline: z.string().max(120).nullable().optional(),
  image: z.string().url("Add a product image"),
  imagePng: optImage("Cutout image"),
  productId: optionalRelId,
  ctaText: z.string().max(40).nullable().optional(),
  ctaUrl: z
    .union([
      z.string().url("Enter a valid URL"),
      z.string().regex(/^\//, "Use a full URL or a path starting with /"),
      z.literal(""),
    ])
    .nullable()
    .optional(),
  animation: z
    .string()
    .refine(isShowcaseAnimation, "Pick a valid animation")
    .default("float"),
  background: z
    .string()
    .refine(isShowcaseBackground, "Pick a valid background")
    .default("aurora"),
  rotationSpeed: z.number().int().min(0).max(100).default(50),
  floatIntensity: z.number().int().min(0).max(100).default(50),
  zoom: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

export type ShowcaseItemInput = z.infer<typeof showcaseItemSchema>;

// Promotional banners --------------------------------------------------------

export const bannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).nullable().optional(),
  subtitle: z.string().max(160).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  desktopImage: z.string().url("Add a desktop image"),
  mobileImage: optImage("Mobile image"),
  desktopImageDark: optImage("Dark desktop image"),
  mobileImageDark: optImage("Dark mobile image"),
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

// Homepage section content (Homepage Section editor) -------------------------
// A link target: a path ("/products"), full URL, or empty string.
const linkHref = z.string().max(200);

const statItemSchema = z.object({
  value: z.string().max(20),
  label: z.string().max(40),
});

const valuePropSchema = z.object({
  icon: z.string().max(40),
  title: z.string().max(60),
  desc: z.string().max(200),
});

const testimonialItemSchema = z.object({
  name: z.string().max(60),
  text: z.string().max(400),
  rating: z.number().int().min(1).max(5),
});

export const heroContentSchema = z.object({
  eyebrow: z.string().max(80),
  title: z.string().max(80),
  highlight: z.string().max(80),
  description: z.string().max(400),
  primaryLabel: z.string().max(40),
  primaryHref: linkHref,
  secondaryLabel: z.string().max(40),
  secondaryHref: linkHref,
  stats: z.array(statItemSchema).max(4),
  bgColor: optHex,
  textColor: optHex,
});

export const aiBannerContentSchema = z.object({
  eyebrow: z.string().max(80),
  title: z.string().max(120),
  description: z.string().max(400),
  ctaLabel: z.string().max(40),
  ctaHref: linkHref,
  bgColor: optHex,
  textColor: optHex,
});

export const headingContentSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(200),
  ctaLabel: z.string().max(40).optional().default(""),
  ctaHref: linkHref.optional().default(""),
  limit: z.number().int().min(1).max(24).optional().default(8),
});

export const whyChooseUsContentSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(200),
  items: z.array(valuePropSchema).max(8),
});

export const testimonialsContentSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(200),
  items: z.array(testimonialItemSchema).max(12),
});

/** Zod schema per editable homepage section key. */
export const homeContentSchemas = {
  hero: heroContentSchema,
  aiBanner: aiBannerContentSchema,
  categories: headingContentSchema,
  featured: headingContentSchema,
  bestSellers: headingContentSchema,
  recommended: headingContentSchema,
  trending: headingContentSchema,
  combos: headingContentSchema,
  whyChooseUs: whyChooseUsContentSchema,
  testimonials: testimonialsContentSchema,
} as const;

export type HomeContentKey = keyof typeof homeContentSchemas;

export type HeroContent = z.infer<typeof heroContentSchema>;
export type AiBannerContent = z.infer<typeof aiBannerContentSchema>;
export type HeadingContent = z.infer<typeof headingContentSchema>;
export type WhyChooseUsContent = z.infer<typeof whyChooseUsContentSchema>;
export type TestimonialsContent = z.infer<typeof testimonialsContentSchema>;
export type ValuePropItem = z.infer<typeof valuePropSchema>;
export type TestimonialItem = z.infer<typeof testimonialItemSchema>;
export type StatItem = z.infer<typeof statItemSchema>;

export function isHomeContentKey(key: string): key is HomeContentKey {
  return key in homeContentSchemas;
}

/** Validate a section's content payload against its schema. */
export function parseHomeContent(
  key: HomeContentKey,
  data: unknown,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const schema = homeContentSchemas[key] as z.ZodTypeAny;
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "Invalid content." };
}

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
  // Returns eligibility; window override null = use the store default.
  returnable: z.boolean().default(true),
  returnWindowDays: z.number().int().min(0).max(365).nullable().optional(),
  // Tax & shipping overrides; null = use the global store default.
  gstRate: z.number().int().min(0, "GST can't be negative").max(100, "GST max 100%").nullable().optional(),
  deliveryCharge: z.number().int().min(0, "Delivery can't be negative").nullable().optional(), // paise
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
  returnable: z.boolean().default(true),
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
    "APPROVED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ]),
  reason: z.string().trim().max(300).optional(),
});

// Inferred types -------------------------------------------------------------

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
export type StoryInput = z.infer<typeof storyInputSchema>;
export type AISettingInput = z.infer<typeof aiSettingSchema>;

// Blog + Legal (CMS content) -------------------------------------------------

export const blogPostSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1, "Slug is required").max(120).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  title: z.string().min(2, "Title is too short").max(160),
  excerpt: z.string().max(400).nullable().optional(),
  content: z.string().min(1, "Add some content"),
  coverImage: optionalUrl,
  author: z.string().max(80).nullable().optional(),
  tag: z.string().max(40).nullable().optional(),
  isPublished: z.boolean().default(true),
  publishedAt: z.coerce.date().optional(),
});
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const contentPageSchema = z.object({
  slug: z.enum(["privacy", "terms", "shipping"]),
  title: z.string().min(1, "Title is required").max(160),
  body: z.string().min(1, "Add some content"),
});
export type ContentPageInput = z.infer<typeof contentPageSchema>;
