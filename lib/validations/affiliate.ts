import { z } from "zod";

export const AFFILIATE_ROLES = [
  "INFLUENCER",
  "AFFILIATE",
  "BRAND_AMBASSADOR",
  "NUTRITIONIST",
  "GYM_PARTNER",
  "BLOGGER",
  "YOUTUBE_CREATOR",
  "INSTAGRAM_CREATOR",
] as const;

export const PAYOUT_METHODS = ["UPI", "BANK_TRANSFER", "RAZORPAYX"] as const;

export const MARKETING_ASSET_TYPES = [
  "PRODUCT_IMAGE",
  "BANNER",
  "LOGO",
  "PDF",
  "SOCIAL_CREATIVE",
  "STORY_TEMPLATE",
  "REEL_ASSET",
  "VIDEO",
  "CATALOGUE",
] as const;

const optUrl = z.union([z.string().url(), z.literal("")]).optional().default("");

/**
 * Forgiving optional website field. People type "mysite.com" without a scheme,
 * which a strict `z.string().url()` rejects — and a failed `z.union` surfaces
 * Zod's cryptic "Invalid input". We normalize a bare domain to `https://…`
 * first, allow blank, and give a real, human error message otherwise.
 */
const optWebsite = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v ?? "";
      const t = v.trim();
      if (!t) return "";
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    },
    z
      .string()
      .refine((v) => v === "" || /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v), {
        message: "Enter a valid website, e.g. yoursite.com",
      }),
  )
  .default("");

// --- Customer -----------------------------------------------------------------

export const applyAffiliateSchema = z.object({
  role: z.enum(AFFILIATE_ROLES),
  displayName: z.string().min(2, "Add a display name").max(60),
  bio: z.string().max(500).optional().default(""),
  website: optWebsite,
  instagram: z.string().max(120).optional().default(""),
  youtube: z.string().max(120).optional().default(""),
  audienceSize: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  pitch: z.string().max(1000).optional().default(""),
  agree: z.boolean().refine((v) => v === true, "Please accept the program terms."),
});

export const payoutDetailsSchema = z.object({
  payoutMethod: z.enum(PAYOUT_METHODS),
  upiId: z.string().max(80).optional().default(""),
  bankName: z.string().max(80).optional().default(""),
  bankAccount: z.string().max(40).optional().default(""),
  bankIfsc: z.string().max(20).optional().default(""),
  accountName: z.string().max(80).optional().default(""),
});

// --- Admin --------------------------------------------------------------------

export const approveAffiliateSchema = z.object({
  affiliateId: z.string().min(1),
  commissionType: z.enum(["PERCENT", "FIXED"]).optional(),
  commissionValue: z.coerce.number().int().min(0).optional(),
  couponCode: z.string().max(20).optional().default(""),
  couponPercent: z.coerce.number().int().min(1).max(100).optional(),
});

export const rejectAffiliateSchema = z.object({
  affiliateId: z.string().min(1),
  reason: z.string().min(1, "Add a reason").max(300),
});

export const suspendAffiliateSchema = z.object({
  affiliateId: z.string().min(1),
  reason: z.string().min(1, "Add a reason").max(300),
});

export const affiliateIdSchema = z.object({ affiliateId: z.string().min(1) });

export const setCommissionSchema = z.object({
  affiliateId: z.string().min(1),
  commissionType: z.enum(["PERCENT", "FIXED"]).nullable().optional(),
  commissionValue: z.coerce.number().int().min(0).nullable().optional(),
});

export const commissionRuleSchema = z.object({
  id: z.string().optional(),
  scope: z.enum(["ROLE", "PRODUCT", "CATEGORY"]),
  role: z.enum(AFFILIATE_ROLES).nullable().optional(),
  productId: z.union([z.string().min(1), z.literal("")]).nullable().optional(),
  categoryId: z.union([z.string().min(1), z.literal("")]).nullable().optional(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});

export const ruleIdSchema = z.object({ id: z.string().min(1) });

export const commissionIdSchema = z.object({ commissionId: z.string().min(1) });

export const cancelCommissionSchema = z.object({
  commissionId: z.string().min(1),
  reason: z.string().max(300).optional().default(""),
});

export const payoutIdSchema = z.object({ payoutId: z.string().min(1) });

export const markPayoutPaidSchema = z.object({
  payoutId: z.string().min(1),
  method: z.enum(PAYOUT_METHODS),
  reference: z.string().max(120).optional().default(""),
});

export const rejectPayoutSchema = z.object({
  payoutId: z.string().min(1),
  reason: z.string().max(300).optional().default(""),
});

export const affiliateSettingsSchema = z.object({
  affiliateEnabled: z.boolean().default(true),
  affiliateCookieDays: z.coerce.number().int().min(1).max(365).default(30),
  affiliateDefaultCommissionType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
  affiliateDefaultCommissionValue: z.coerce.number().int().min(0).default(10),
  affiliateMinPayout: z.coerce.number().int().min(0).default(50000),
});

export const marketingAssetSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Add a title").max(120),
  description: z.string().max(500).optional().default(""),
  type: z.enum(MARKETING_ASSET_TYPES),
  fileUrl: z.string().url("Upload a file or paste a URL"),
  thumbnailUrl: optUrl,
  isActive: z.boolean().default(true),
});
