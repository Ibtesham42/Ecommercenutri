"use server";

import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/recommendations/events";
import { createVerificationToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/emails";
import { isPlaceholderEmail } from "@/lib/phone-account";
import { browserLimitKey } from "@/lib/spin/limits";
import {
  SPIN_COOKIE,
  SpinError,
  canClaimSpin,
  claimSpin,
  getLiveCampaign,
  spinWheel,
  toSpinView,
  type SpinView,
} from "@/lib/spin/service";

const ANON_COOKIE = "nut_anon";

export type SpinActionResult =
  | { ok: true; view: SpinView; signedIn: boolean; reassigned?: boolean; needsVerification?: boolean }
  | { ok: false; error: string; code?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function friendly(err: unknown, fallback: string): SpinActionResult {
  if (err instanceof SpinError) return { ok: false, error: err.message, code: err.code };
  console.error("[spin]", err);
  return { ok: false, error: fallback };
}

/** Spin the wheel. Takes no input — nothing about the prize comes from the client. */
export async function spinAction(): Promise<SpinActionResult> {
  try {
    const user = await getCurrentUser();
    const jar = await cookies();
    const anonId = jar.get(ANON_COOKIE)?.value ?? null;
    const claimToken = jar.get(SPIN_COOKIE)?.value ?? null;

    await trackEvent({ type: "SPIN_START", userId: user?.id ?? null, anonId: user ? null : anonId, source: "spin-win" });

    // The engine calls this only right before creating a NEW anonymous spin —
    // after it has checked the cookie against the DB — so no cookie value
    // (valid, stale or forged) can skip the limit for a fresh spin. Browser
    // first: a browser that's out of spins doesn't use up its IP's allowance.
    const allowAnonymousSpin = async () => {
      const ip = await clientIp();
      const ua = (await headers()).get("user-agent") ?? "";
      const byBrowser = await checkRateLimit(limiters.spinBrowser, browserLimitKey(anonId, ip, ua));
      if (!byBrowser.success) return false;
      return (await checkRateLimit(limiters.spinIp, `ip:${ip}`)).success;
    };

    const outcome = await spinWheel({ userId: user?.id ?? null, anonId, claimToken, allowAnonymousSpin });
    if (outcome.claimToken) {
      const campaign = await getLiveCampaign();
      jar.set(SPIN_COOKIE, outcome.claimToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: (campaign?.claimWindowHours ?? 24) * 3600,
      });
    }
    if (outcome.created) {
      await trackEvent({
        type: "SPIN_WIN",
        userId: user?.id ?? null,
        anonId: user ? null : anonId,
        productId: outcome.spin.productId,
        source: `spin-${outcome.spin.percent}`,
      });
      if (user) await trackEvent({ type: "SPIN_CLAIM", userId: user.id, productId: outcome.spin.productId, source: "spin-win" });
    }
    // Signed in but the win is still held → the account must verify to claim.
    const needsVerification =
      user != null && outcome.spin.status === "AWARDED" && !(await canClaimSpin(user.id));
    return { ok: true, view: await toSpinView(outcome.spin), signedIn: Boolean(user), needsVerification };
  } catch (err) {
    return friendly(err, "The wheel couldn't spin just now. Please try again.");
  }
}

/**
 * Claim a held win for the signed-in account: the anonymous win in this
 * browser's cookie, else the account's own held win (spun before verifying).
 * Verification, expiry, caps and stock are all re-checked server-side.
 */
export async function claimSpinAction(): Promise<SpinActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in to claim your offer.", code: "AUTH" };
    const jar = await cookies();
    const token = jar.get(SPIN_COOKIE)?.value ?? null;

    const rl = await checkRateLimit(limiters.spinClaim, `user:${user.id}`);
    if (!rl.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

    const { spin, reassigned } = await claimSpin({ userId: user.id, claimToken: token });
    if (token) jar.delete(SPIN_COOKIE);
    await trackEvent({ type: "SPIN_AUTH", userId: user.id, source: "spin-win" });
    await trackEvent({ type: "SPIN_CLAIM", userId: user.id, productId: spin.productId, source: "spin-win" });
    return { ok: true, view: await toSpinView(spin), signedIn: true, reassigned };
  } catch (err) {
    if (err instanceof SpinError && ["EXPIRED", "NOT_FOUND", "ALREADY_CLAIMED"].includes(err.code)) {
      // Dead token — drop it so the page stops offering to claim it.
      try {
        (await cookies()).delete(SPIN_COOKIE);
      } catch {
        /* ignore */
      }
    }
    return friendly(err, "We couldn't claim your offer just now. Please try again.");
  }
}

export type VerificationMailResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Recovery path for the "verify to claim" gate: (re)send the standard email
 * verification link (same token + email as sign-up), returning to /spin.
 */
export async function sendSpinVerificationEmail(): Promise<VerificationMailResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const rl = await checkRateLimit(limiters.spinClaim, `verify-mail:${user.id}`);
  if (!rl.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerified: true, name: true },
  });
  if (!row) return { ok: false, error: "Please sign in first." };
  if (isPlaceholderEmail(row.email)) {
    return { ok: false, error: "Add an email address in your profile first, or verify your phone number there." };
  }
  if (row.emailVerified) return { ok: true, message: "Your email is already verified — you can claim your offer now." };

  try {
    const token = await createVerificationToken(row.email);
    const url = `${env.appUrl}/verify-email?token=${token}&next=${encodeURIComponent("/spin")}`;
    await sendEmail({ to: row.email, ...verificationEmail(url, row.name) });
  } catch (err) {
    console.error("[spin] verification email failed:", err);
    return { ok: false, error: "We couldn't send the email just now. Please try again." };
  }
  return { ok: true, message: `We've sent a verification link to ${row.email}. Open it, then come back here to claim.` };
}
