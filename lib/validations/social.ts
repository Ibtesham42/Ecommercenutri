import { z } from "zod";

/**
 * Zod schemas for the AI Marketing (social automation) admin. Enum value tuples
 * mirror the Prisma enums; kept here (not imported from @prisma/client) so the
 * schemas stay usable on the client too.
 */

export const SOCIAL_PLATFORM_VALUES = ["INSTAGRAM", "FACEBOOK"] as const;
export const SOCIAL_MODE_VALUES = ["AUTO_PUBLISH", "MANUAL_APPROVAL", "DRAFT"] as const;
export const SOCIAL_PILLAR_VALUES = [
  "PRODUCT_KNOWLEDGE",
  "HEALTHY_SNACKING",
  "TARGET_AUDIENCE",
  "WHY_NUTRIYET",
  "LIFESTYLE",
  "RECIPES",
  "COMMUNITY",
  "CUSTOMER_STORIES",
] as const;
export const SOCIAL_DAYPART_VALUES = ["MORNING", "EVENING"] as const;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour).");

const daysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Pick at least one day.");

// Accept a datetime-local / ISO string or empty → null.
const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date.");

export const socialCampaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the campaign.").max(120),
  enabled: z.boolean().default(true),
  platforms: z.array(z.enum(SOCIAL_PLATFORM_VALUES)).min(1, "Pick a platform."),
  productIds: z.array(z.string()).default([]),
  mode: z.enum(SOCIAL_MODE_VALUES),
  morningTime: timeSchema,
  eveningTime: timeSchema,
  days: daysSchema,
  maxPerDay: z.number().int().min(1).max(10),
  startsAt: optionalDate,
  endsAt: optionalDate,
});
export type SocialCampaignInput = z.infer<typeof socialCampaignSchema>;

export const socialSettingsSchema = z.object({
  enabled: z.boolean(),
  brandVoice: z.string().trim().max(600),
  morningTime: timeSchema,
  eveningTime: timeSchema,
  days: daysSchema,
  maxPerDay: z.number().int().min(1).max(10),
  mode: z.enum(SOCIAL_MODE_VALUES),
  defaultHashtags: z.array(z.string().trim()).max(40).default([]),
  bannedWords: z.array(z.string().trim()).max(60).default([]),
  carouselEnabled: z.boolean(),
});
export type SocialSettingsInput = z.infer<typeof socialSettingsSchema>;

export const socialPostEditSchema = z.object({
  id: z.string().min(1),
  hook: z.string().trim().max(200).default(""),
  caption: z.string().trim().min(1, "Caption can't be empty.").max(2200),
  captionLong: z.string().trim().max(4000).optional().default(""),
  cta: z.string().trim().max(60).default(""),
  hashtags: z.array(z.string().trim()).max(30).default([]),
  altText: z.string().trim().max(200).default(""),
  imageUrls: z.array(z.string().url()).max(10).default([]),
  // On-image text — printed INTO the creative by lib/social/creative, not a
  // plain DB field like caption. Changing these re-renders the cover so the
  // image always matches what's stored (see updateSocialPost).
  headline: z.string().trim().max(32).optional().default(""),
  support: z.string().trim().max(40).optional().default(""),
  // Publish schedule. Nullable: clearing it un-schedules a SCHEDULED post back
  // to a draft-like state without a fixed time (the approve flow will re-set it).
  scheduledFor: z.coerce.date().optional().nullable(),
});
export type SocialPostEditInput = z.infer<typeof socialPostEditSchema>;

export const socialGenerateSchema = z.object({
  productId: z.string().optional().nullable(),
  pillar: z.enum(SOCIAL_PILLAR_VALUES),
  daypart: z.enum(SOCIAL_DAYPART_VALUES),
  angle: z.string().trim().max(120).optional().default(""),
});
export type SocialGenerateInput = z.infer<typeof socialGenerateSchema>;

export const socialTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the template.").max(120),
  pillar: z.enum(SOCIAL_PILLAR_VALUES),
  promptGuidance: z.string().trim().min(1, "Add some guidance.").max(1000),
});
export type SocialTemplateInput = z.infer<typeof socialTemplateSchema>;
