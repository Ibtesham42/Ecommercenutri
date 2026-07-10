import { z } from "zod";

/**
 * Zod schemas for the Competitor Intelligence admin. Enum value tuples mirror
 * the Prisma enums; kept here (not imported from @prisma/client) so the
 * schemas stay usable on the client too.
 */

export const COMPETITOR_PRIORITY_VALUES = ["HIGH", "MEDIUM", "LOW"] as const;
export const INTEL_SOURCE_VALUES = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "BLOG",
  "WEBSITE",
  "OTHER",
] as const;
export const INTEL_SIGNAL_KIND_VALUES = [
  "POST",
  "REEL",
  "CAROUSEL",
  "STORY",
  "VIDEO",
  "BLOG_POST",
  "PRODUCT_LAUNCH",
  "CAMPAIGN",
  "HASHTAG",
  "OTHER",
] as const;
export const IDEA_STATUS_VALUES = ["SUGGESTED", "SHORTLISTED", "USED", "DISMISSED"] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//.test(v), "Must be a full URL (https://…).");

const optionalHandle = z
  .string()
  .trim()
  .max(80)
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/^@/, "") : null));

export const competitorSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the competitor.").max(120),
  category: z.string().trim().min(1, "Pick a category.").max(80),
  priority: z.enum(COMPETITOR_PRIORITY_VALUES),
  active: z.boolean().default(true),
  instagram: optionalHandle,
  facebook: optionalHandle,
  linkedin: optionalHandle,
  website: optionalUrl,
  blogUrl: optionalUrl,
  notes: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
});
export type CompetitorInput = z.infer<typeof competitorSchema>;

const optionalInt = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

export const competitorSignalSchema = z.object({
  competitorId: z.string().min(1),
  source: z.enum(INTEL_SOURCE_VALUES),
  kind: z.enum(INTEL_SIGNAL_KIND_VALUES),
  title: z.string().trim().min(1, "Describe what you observed.").max(200),
  summary: z.string().trim().max(1200).optional().nullable().transform((v) => v || null),
  url: optionalUrl,
  postedAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date."),
  likes: optionalInt,
  comments: optionalInt,
  shares: optionalInt,
  views: optionalInt,
  hashtags: z.array(z.string().trim()).max(20).default([]),
  topics: z.array(z.string().trim()).max(12).default([]),
});
export type CompetitorSignalInput = z.infer<typeof competitorSignalSchema>;

export const intelligenceSettingsSchema = z.object({
  enabled: z.boolean(),
  runHour: z.number().int().min(0).max(23),
  competitorRefreshDays: z.number().int().min(1).max(30),
  ideasPerBatch: z.number().int().min(5).max(30),
  minIdeaScore: z.number().int().min(50).max(100),
});
export type IntelligenceSettingsInput = z.infer<typeof intelligenceSettingsSchema>;

export const ideaStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(IDEA_STATUS_VALUES),
});
export type IdeaStatusInput = z.infer<typeof ideaStatusSchema>;
