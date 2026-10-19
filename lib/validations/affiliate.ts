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

const trimmed = (max: number) => z.string().trim().max(max).optional().default("");

/** Payout destination — must be complete for the chosen method, or a payout could
 *  be requested with nowhere to send it. RazorpayX isn't offered to affiliates yet. */
export const payoutDetailsSchema = z
  .object({
    payoutMethod: z.enum(PAYOUT_METHODS),
    upiId: trimmed(80),
    bankName: trimmed(80),
    bankAccount: z.string().overwrite((v) => v.replace(/\s+/g, "")).max(40).optional().default(""),
    bankIfsc: z.string().trim().toUpperCase().max(20).optional().default(""),
    accountName: trimmed(80),
  })
  .superRefine((d, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.payoutMethod === "RAZORPAYX") {
      fail("payoutMethod", "RazorpayX payouts aren't available yet — choose UPI or bank transfer.");
    } else if (d.payoutMethod === "UPI") {
      if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(d.upiId)) {
        fail("upiId", "Enter a valid UPI ID, e.g. name@okbank.");
      }
    } else {
      if (d.accountName.length < 2) fail("accountName", "Enter the account holder's name.");
      if (!/^\d{9,18}$/.test(d.bankAccount)) fail("bankAccount", "Enter a valid account number (9–18 digits).");
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bankIfsc)) fail("bankIfsc", "Enter a valid IFSC code, e.g. HDFC0001234.");
    }
  });

// --- Admin --------------------------------------------------------------------

/** A PERCENT commission above 100% would pay out more than the sale. */
const percentCap = (type: string | null | undefined, value: number | null | undefined) =>
  type !== "PERCENT" || value == null || value <= 100;
const PERCENT_CAP_MSG = { message: "A percentage commission can't be more than 100%.", path: ["commissionValue"] };

export const approveAffiliateSchema = z.object({
  affiliateId: z.string().min(1),
  commissionType: z.enum(["PERCENT", "FIXED"]).optional(),
  commissionValue: z.coerce.number().int().min(0).optional(),
  couponCode: z.string().max(20).optional().default(""),
  couponPercent: z.coerce.number().int().min(1).max(100).optional(),
}).refine((d) => percentCap(d.commissionType, d.commissionValue), PERCENT_CAP_MSG);

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
}).refine((d) => percentCap(d.commissionType, d.commissionValue), PERCENT_CAP_MSG);

export const commissionRuleSchema = z.object({
  id: z.string().optional(),
  scope: z.enum(["ROLE", "PRODUCT", "CATEGORY"]),
  role: z.enum(AFFILIATE_ROLES).nullable().optional(),
  productId: z.union([z.string().min(1), z.literal("")]).nullable().optional(),
  categoryId: z.union([z.string().min(1), z.literal("")]).nullable().optional(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
}).refine((d) => percentCap(d.type, d.value), { ...PERCENT_CAP_MSG, path: ["value"] });

export const ruleIdSchema = z.object({ id: z.string().min(1) });

export const commissionIdSchema = z.object({ commissionId: z.string().min(1) });

export const cancelCommissionSchema = z.object({
  commissionId: z.string().min(1),
  reason: z.string().max(300).optional().default(""),
});

/** Required only to act on a payout whose affiliate isn't active (suspended):
 *  the admin's explicit, recorded reason for paying anyway. */
const overrideReason = z.string().trim().min(5, "Give a reason (5+ characters) for paying a suspended affiliate.").max(300).optional();

export const payoutIdSchema = z.object({ payoutId: z.string().min(1), overrideReason });

export const markPayoutPaidSchema = z.object({
  payoutId: z.string().min(1),
  method: z.enum(PAYOUT_METHODS),
  // Marking paid records money that has already moved — the transfer's own
  // reference (bank UTR / UPI transaction id) is the proof, so it's required.
  reference: z.string().trim().min(4, "Add the transfer reference (bank UTR or UPI transaction ID).").max(120),
  overrideReason,
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
}).refine((d) => percentCap(d.affiliateDefaultCommissionType, d.affiliateDefaultCommissionValue), {
  ...PERCENT_CAP_MSG,
  path: ["affiliateDefaultCommissionValue"],
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
