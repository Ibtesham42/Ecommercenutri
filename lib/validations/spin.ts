import { z } from "zod";
import { MAX_PRIZE_TIERS, PRIZE_PERCENT_MAX, PRIZE_PERCENT_MIN } from "@/lib/spin/config";

const optDate = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return d;
  });

const optPaise = z.number().int().min(0).max(100_000_000).nullable().optional();

export const spinCampaignSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().min(2, "Give the campaign a name.").max(80),
    isActive: z.boolean(),
    startsAt: optDate,
    endsAt: optDate,
    prizes: z
      .array(
        z.object({
          percent: z
            .number()
            .int()
            .min(PRIZE_PERCENT_MIN, `Discounts must be ${PRIZE_PERCENT_MIN}–${PRIZE_PERCENT_MAX}%.`)
            .max(PRIZE_PERCENT_MAX, `Discounts must be ${PRIZE_PERCENT_MIN}–${PRIZE_PERCENT_MAX}%.`),
          weight: z.number().int().min(0).max(1000),
        }),
      )
      .min(2, "Add at least two prize tiers.")
      .max(MAX_PRIZE_TIERS, `At most ${MAX_PRIZE_TIERS} prize tiers.`),
    eligibleVariantIds: z.array(z.string().trim().min(1).max(40)).max(300),
    minStock: z.number().int().min(0).max(100_000),
    weightCap: z.number().int().min(1).max(100_000),
    claimWindowHours: z.number().int().min(1).max(168),
    offerValidDays: z.number().int().min(1).max(90),
    maxClaims: z.number().int().min(1).max(10_000_000).nullable().optional(),
    minOrder: optPaise,
    maxDiscount: optPaise,
    saleMode: z.enum(["STACK", "BEST_OF", "EXCLUDE"]),
  })
  .superRefine((d, ctx) => {
    const percents = d.prizes.map((p) => p.percent);
    if (new Set(percents).size !== percents.length) {
      ctx.addIssue({ code: "custom", path: ["prizes"], message: "Each prize tier needs a different percentage." });
    }
    if (!d.prizes.some((p) => p.weight > 0)) {
      ctx.addIssue({ code: "custom", path: ["prizes"], message: "At least one tier needs a weight above 0." });
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end date must be after the start date." });
    }
    if (d.isActive && d.eligibleVariantIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["eligibleVariantIds"], message: "Select eligible products before enabling the campaign." });
    }
  });

export type SpinCampaignInput = z.input<typeof spinCampaignSchema>;

/** Admin confirmation that the exact variant list was checked against the live catalogue. */
export const verifyEligibilitySchema = z.object({
  id: z.string().trim().min(1),
  variantIds: z.array(z.string().trim().min(1).max(40)).min(1).max(300),
  confirmed: z.literal(true, { message: "Confirm that you checked every product, size and variant ID." }),
});
