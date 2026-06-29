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
  scheduledFor: z.string().optional().nullable(),
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
