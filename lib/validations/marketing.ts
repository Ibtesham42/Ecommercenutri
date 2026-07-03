import { z } from "zod";

export const CHANNEL_VALUES = ["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"] as const;
export const SEGMENT_VALUES = [
  "ALL_USERS",
  "CUSTOMERS",
  "AFFILIATES",
  "PRODUCT_BUYERS",
  "CATEGORY_BUYERS",
  "WISHLIST",
  "ABANDONED_CART",
  "INACTIVE",
  "SELECTED",
] as const;
export const CAMPAIGN_TYPE_VALUES = ["BROADCAST", "PRODUCT", "COUPON", "AUTOMATION"] as const;

const optStr = z.union([z.string(), z.literal("")]).optional().default("");

export const segmentConfigSchema = z.object({
  productId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  userIds: z.array(z.string()).optional(),
  inactiveDays: z.coerce.number().int().min(1).max(3650).optional().nullable(),
});

export const campaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name the campaign").max(120),
  type: z.enum(CAMPAIGN_TYPE_VALUES).default("BROADCAST"),
  channels: z.array(z.enum(CHANNEL_VALUES)).min(1, "Pick at least one channel"),
  title: z.string().min(1, "Add a title").max(140),
  body: z.string().min(1, "Add a message").max(4000),
  imageUrl: optStr,
  ctaText: z.string().max(40).optional().default(""),
  ctaUrl: z.string().max(400).optional().default(""),
  segmentType: z.enum(SEGMENT_VALUES).default("ALL_USERS"),
  segmentConfig: segmentConfigSchema.optional(),
  productId: z.string().optional().nullable(),
  couponId: z.string().optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional().default("NONE"),
  scheduledFor: z.string().optional().nullable(),
});

/** "Send test to me" — the compose content + channels, nothing persisted. */
export const campaignTestSchema = campaignSchema.pick({
  channels: true,
  title: true,
  body: true,
  imageUrl: true,
  ctaText: true,
  ctaUrl: true,
});

export const segmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name the segment").max(120),
  type: z.enum(SEGMENT_VALUES),
  config: segmentConfigSchema.optional(),
});

export const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name the template").max(120),
  category: z.string().min(1).max(40),
  channels: z.array(z.enum(CHANNEL_VALUES)).min(1),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(4000),
  ctaText: z.string().max(40).optional().default(""),
  imageUrl: optStr,
});

export const aiGenerateSchema = z.object({
  prompt: z.string().min(3, "Describe the campaign").max(600),
  tone: z.string().max(40).optional(),
  channel: z.string().max(20).optional(),
});

export const audiencePreviewSchema = z.object({
  type: z.enum(SEGMENT_VALUES),
  config: segmentConfigSchema.optional(),
});

export const AUTOMATION_TRIGGER_VALUES = ["WELCOME", "ABANDONED_CART", "WINBACK", "POST_PURCHASE"] as const;

export const automationRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name the automation").max(120),
  trigger: z.enum(AUTOMATION_TRIGGER_VALUES),
  enabled: z.boolean().default(true),
  delayHours: z.coerce.number().int().min(0).max(8760).default(24),
  channels: z.array(z.enum(CHANNEL_VALUES)).min(1, "Pick at least one channel"),
  title: z.string().min(1, "Add a title").max(140),
  body: z.string().min(1, "Add a message").max(4000),
  imageUrl: optStr,
  ctaText: z.string().max(40).optional().default(""),
  ctaUrl: z.string().max(400).optional().default(""),
  couponId: z.string().optional().nullable(),
});
