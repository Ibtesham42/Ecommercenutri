import { z } from "zod";
import { surveyQuestion, optionKeys } from "@/lib/survey";

/** Enum of a catalog question's option keys (single source of truth). */
function single(id: string) {
  return z.enum(optionKeys(surveyQuestion(id)!));
}
function multi(id: string, max = 12) {
  return z.array(single(id)).max(max).default([]);
}

const shortText = z.string().trim().max(120).optional().or(z.literal(""));

export const surveyResponseSchema = z
  .object({
    ageGroup: single("ageGroup"),
    gender: single("gender"),
    occupation: single("occupation"),
    occupationOther: shortText,
    city: shortText,
    snackFrequency: single("snackFrequency"),
    snacks: multi("snacks"),
    snacksOther: shortText,
    snackPriority: single("snackPriority"),
    makhanaEaten: single("makhanaEaten"),
    makhanaAware: single("makhanaAware"),
    makhanaForms: multi("makhanaForms"),
    makhanaBarriers: multi("makhanaBarriers"),
    makhanaBarrierOther: shortText,
    buyPlaces: multi("buyPlaces"),
    packSize: single("packSize"),
    flavours: multi("flavours"),
    flavourOther: shortText,
    learnInterest: single("learnInterest"),
    topics: multi("topics"),
    wantsUpdates: single("wantsUpdates"),
    contactName: z.string().trim().max(80).optional().or(z.literal("")),
    contactMobile: z
      .string()
      .trim()
      .regex(/^[0-9+\-() ]{7,16}$/, "Enter a valid mobile number")
      .optional()
      .or(z.literal("")),
    contactEmail: z
      .string()
      .trim()
      .email("Enter a valid email")
      .max(120)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    // Contact details only make sense when the respondent opted in.
    if (d.wantsUpdates !== "yes" && (d.contactName || d.contactMobile || d.contactEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wantsUpdates"],
        message: "Contact details are only collected when you opt into updates.",
      });
    }
  });

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
