"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/recommendations/events";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/emails";
import { createVerificationToken } from "@/lib/tokens";
import { registerSchema } from "@/lib/validations/auth";
import { quizAnswersSchema } from "@/lib/validations/quiz";
import { scoreQuiz, type QuizRecommendations, type QuizBand } from "@/lib/quiz/score";
import { getQuizRecommendedProducts } from "@/lib/quiz/recommend";
import type { ProductCardData } from "@/lib/queries/products";
import { getGrowthSettings } from "@/lib/growth-settings";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings } from "@/lib/ai/settings";
import type { QuizAnswers } from "@/lib/quiz/questions";

const ANON_COOKIE = "nut_anon";

/** Get the anon cookie id, creating + persisting one if absent (quiz can be the
 *  first action a visitor takes, before any /api/track beacon has run). */
async function anonId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(ANON_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    jar.set(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return id;
}

/** Optionally rewrite the summary prose with AI (score/tips/focus stay
 *  deterministic + honest). Falls back to the rule-based summary on any issue. */
async function enhanceSummary(base: string, answers: QuizAnswers, score: number, band: QuizBand): Promise<string> {
  if (!aiAvailable()) return base;
  try {
    const settings = await getAISettings();
    const model = getModel(settings.model);
    if (!model) return base;
    const { text } = await generateText({
      model,
      temperature: 0.6,
      system:
        "You are a warm, encouraging nutrition coach for Nutriyet, an Indian healthy-snack store. Write a friendly 2-sentence summary of the shopper's health quiz result. Be positive and specific, reference their score and goal, and avoid medical claims or diagnoses. No markdown.",
      prompt: `Score: ${score}/100 (band: ${band}). Answers: goal=${answers.goal}, age=${answers.age}, exercise=${answers.exercise}, snack=${answers.snack}, spice=${answers.spice}, water=${answers.water}. Baseline summary: "${base}"`,
    });
    const clean = text.trim();
    return clean.length > 20 && clean.length < 600 ? clean : base;
  } catch (err) {
    console.error("[quiz] AI summary failed:", err);
    return base;
  }
}

export type CompleteQuizResult =
  | {
      ok: true;
      id: string;
      score: number;
      band: QuizBand;
      summary: string;
      teaserTips: string[]; // first tip only — the rest unlock after signup
      totalTips: number;
      focusCount: number;
      // Real, in-stock, goal-matched products (add-to-cart ready) — the AI
      // Assessment's actual recommendations, not bare search links.
      recommendedProducts: ProductCardData[];
    }
  | { ok: false; error: string };

/** Score an anonymous quiz submission and persist it (claimed to an account on
 *  signup). Returns a teaser; the full report unlocks after account creation. */
export async function completeQuiz(input: unknown): Promise<CompleteQuizResult> {
  const growth = await getGrowthSettings();
  if (!growth.quizEnabled) return { ok: false, error: "The health quiz isn't available right now." };

  const parsed = quizAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please answer all the questions." };
  const answers = parsed.data as QuizAnswers;

  const anon = await anonId();
  const rl = await checkRateLimit(limiters.api, `quiz:${anon}`);
  if (!rl.success) return { ok: false, error: "Please wait a moment before trying again." };

  try {
    const result = scoreQuiz(answers);
    const summary = await enhanceSummary(result.recommendations.summary, answers, result.score, result.band);
    const recommendations: QuizRecommendations = { ...result.recommendations, summary };

    const row = await prisma.healthQuizResult.create({
      data: {
        anonId: anon,
        score: result.score,
        band: result.band,
        answers: answers as object,
        recommendations: recommendations as object,
      },
      select: { id: true },
    });

    await trackEvent({ type: "QUIZ_COMPLETE", anonId: anon, source: result.band });

    // Real in-stock product recs — best-effort so catalog/search issues never
    // break the result the shopper just earned.
    let recommendedProducts: ProductCardData[] = [];
    try {
      recommendedProducts = await getQuizRecommendedProducts(recommendations.focus, 4);
    } catch (recErr) {
      console.error("[quiz] product recs failed:", recErr);
    }

    return {
      ok: true,
      id: row.id,
      score: result.score,
      band: result.band,
      summary,
      teaserTips: recommendations.tips.slice(0, 1),
      totalTips: recommendations.tips.length,
      focusCount: recommendations.focus.length,
      recommendedProducts,
    };
  } catch (err) {
    console.error("[quiz] completeQuiz failed:", err);
    return { ok: false, error: "Couldn't generate your result. Please try again." };
  }
}

/** Ensure the shared welcome coupon exists (idempotent) and return its code. */
export async function ensureWelcomeCoupon(): Promise<string> {
  const growth = await getGrowthSettings();
  const code = growth.couponCode;
  try {
    await prisma.coupon.upsert({
      where: { code },
      update: {}, // never overwrite an admin-tuned coupon
      create: {
        code,
        description: `${growth.couponPercent}% welcome discount for new members`,
        type: "PERCENT",
        value: growth.couponPercent,
        isActive: true,
        perUserLimit: 1,
      },
    });
  } catch (err) {
    console.error("[quiz] ensureWelcomeCoupon failed:", err);
  }
  return code;
}

/** Attach unclaimed anon quiz results to a user + grant the welcome coupon.
 *  Idempotent; safe to call on every account load. Returns whether anything
 *  was newly claimed (so the caller can fire the QUIZ_SIGNUP conversion event). */
async function claimForUser(userId: string, anon: string | undefined, preferId?: string): Promise<boolean> {
  const where = preferId
    ? { id: preferId, userId: null }
    : anon
      ? { anonId: anon, userId: null }
      : null;
  if (!where) return false;
  const pending = await prisma.healthQuizResult.findMany({ where, select: { id: true } });
  if (pending.length === 0) return false;

  const code = await ensureWelcomeCoupon();
  await prisma.healthQuizResult.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { userId, claimedAt: new Date(), couponCode: code },
  });
  return true;
}

/** Claim any pending anon quiz for the signed-in user (called on account load). */
export async function claimQuizForCurrentUser(): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return;
    const jar = await cookies();
    const anon = jar.get(ANON_COOKIE)?.value;
    const claimed = await claimForUser(user.id, anon);
    if (claimed) {
      await trackEvent({ type: "QUIZ_SIGNUP", userId: user.id });
      await trackEvent({ type: "COUPON_CLAIM", userId: user.id });
    }
  } catch (err) {
    console.error("[quiz] claimQuizForCurrentUser failed:", err);
  }
}

/** Reveal the shared welcome coupon (creating it if needed) + record the claim.
 *  The code is public and works at checkout for any new customer (perUserLimit
 *  1) — the quiz/popup/sticky bar all surface it. */
export async function revealWelcomeCoupon(): Promise<{ code: string; percent: number }> {
  const growth = await getGrowthSettings();
  const code = await ensureWelcomeCoupon();
  try {
    const user = await getCurrentUser();
    const jar = await cookies();
    const anon = jar.get(ANON_COOKIE)?.value ?? null;
    await trackEvent({
      type: "COUPON_CLAIM",
      userId: user?.id ?? null,
      anonId: user ? null : anon,
    });
  } catch (err) {
    console.error("[quiz] revealWelcomeCoupon track failed:", err);
  }
  return { code, percent: growth.couponPercent };
}

export type QuizSignupState = { error?: string } | undefined;

/** Create an account from the quiz result screen, claim the report + coupon,
 *  and sign the shopper in — the highest-converting path (they've already seen
 *  their score). Additive: does not touch the existing register flow. */
export async function quizSignup(_prev: QuizSignupState, formData: FormData): Promise<QuizSignupState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const { name, email, password } = parsed.data;
  const resultId = typeof formData.get("resultId") === "string" ? (formData.get("resultId") as string) : undefined;

  const anon = await anonId();
  const rl = await checkRateLimit(limiters.auth, `quizsignup:${anon}`);
  if (!rl.success) return { error: "Too many attempts. Please try again later." };

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return { error: "An account with this email already exists — please sign in to see your report." };
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, passwordHash }, select: { id: true } });

    const claimed = await claimForUser(user.id, anon, resultId);
    // If the preferred id didn't match (edge case), fall back to anon match.
    if (!claimed) await claimForUser(user.id, anon);
    await trackEvent({ type: "QUIZ_SIGNUP", userId: user.id });
    await trackEvent({ type: "COUPON_CLAIM", userId: user.id });

    // Best-effort verification email (mirrors registerAction; never blocks signup).
    try {
      const token = await createVerificationToken(email);
      await sendEmail({ to: email, ...verificationEmail(`${env.appUrl}/verify-email?token=${token}`, name) });
    } catch (mailErr) {
      console.error("[quiz] verification email failed:", mailErr);
    }

    await signIn("credentials", { email, password, redirectTo: "/account?welcome=1" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Account was created but auto sign-in failed — send them to login.
      return { error: "Account created! Please sign in to view your health report." };
    }
    // signIn throws a redirect on success — must be rethrown.
    throw error;
  }
  return undefined;
}
