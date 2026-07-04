import { z } from "zod";

/** Admin "Growth" (conversion-optimization) settings form. Mirrors GrowthBlob;
 *  values are re-normalized by resolveGrowth on read, so this is lenient. */
export const growthSettingsSchema = z.object({
  quizEnabled: z.boolean(),
  welcomePopupEnabled: z.boolean(),
  stickyBarEnabled: z.boolean(),
  trustEnabled: z.boolean(),
  couponCode: z
    .string()
    .trim()
    .min(3, "Coupon code is too short")
    .max(24, "Coupon code is too long")
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only"),
  couponPercent: z.coerce.number().int().min(1, "At least 1%").max(90, "At most 90%"),
  popupTitle: z.string().trim().max(80).optional().default(""),
  popupSubtitle: z.string().trim().max(160).optional().default(""),
  stickyText: z.string().trim().max(160).optional().default(""),
});

export type GrowthSettingsInput = z.infer<typeof growthSettingsSchema>;
