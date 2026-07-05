"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { surveyResponseSchema } from "@/lib/validations/survey";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export type SurveySubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Store one public survey submission. No auth (the survey is link-only and
 * anonymous by default); rate-limited per IP so the endpoint can't be spammed.
 * Contact details are kept only when the respondent opted into updates.
 */
export async function submitSurveyResponse(input: unknown): Promise<SurveySubmitResult> {
  const fwd = (await headers()).get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || "anon";
  const rl = await checkRateLimit(limiters.api, `survey:${ip}`);
  if (!rl.success) {
    return { ok: false, error: "Too many submissions. Please try again in a minute." };
  }

  const parsed = surveyResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please answer the required questions.",
    };
  }
  const d = parsed.data;
  const optedIn = d.wantsUpdates === "yes";

  try {
    await prisma.surveyResponse.create({
      data: {
        ageGroup: d.ageGroup,
        gender: d.gender,
        occupation: d.occupation,
        occupationOther: d.occupationOther || null,
        city: d.city || null,
        snackFrequency: d.snackFrequency,
        snacks: d.snacks,
        snacksOther: d.snacksOther || null,
        snackPriority: d.snackPriority,
        makhanaEaten: d.makhanaEaten,
        makhanaAware: d.makhanaAware,
        makhanaForms: d.makhanaForms,
        makhanaBarriers: d.makhanaBarriers,
        makhanaBarrierOther: d.makhanaBarrierOther || null,
        buyPlaces: d.buyPlaces,
        packSize: d.packSize,
        flavours: d.flavours,
        flavourOther: d.flavourOther || null,
        learnInterest: d.learnInterest,
        topics: d.topics,
        wantsUpdates: d.wantsUpdates,
        contactName: optedIn ? d.contactName || null : null,
        contactMobile: optedIn ? d.contactMobile || null : null,
        contactEmail: optedIn ? d.contactEmail || null : null,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[survey] submit failed:", err);
    return { ok: false, error: "Could not save your response. Please try again." };
  }
}
