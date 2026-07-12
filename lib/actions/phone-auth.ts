"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/utils";
import {
  generateOtpCode,
  isPhoneAuthEnabled,
  sendOtpSms,
  storeOtp,
} from "@/lib/otp";
import {
  normalizeIndianPhone,
  otpRequestSchema,
  otpVerifySchema,
} from "@/lib/validations/auth";

export type RequestOtpResult =
  | { ok: true; phone: string; devCode?: string }
  | { ok: false; error: string };

async function clientIdentifier(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "anon"
  );
}

/** Sends a login OTP. Returns the normalized phone the UI should verify with. */
export async function requestOtpAction(raw: unknown): Promise<RequestOtpResult> {
  if (!isPhoneAuthEnabled()) {
    return { ok: false, error: "Phone login isn't available right now — please use email." };
  }

  const parsed = otpRequestSchema.safeParse(raw);
  const phone = parsed.success ? normalizeIndianPhone(parsed.data.phone) : null;
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }

  // Throttle per phone AND per caller so neither can be used to spam SMS.
  const [byPhone, byIp] = await Promise.all([
    checkRateLimit(limiters.auth, `otp:${phone}`),
    checkRateLimit(limiters.auth, `otp:${await clientIdentifier()}`),
  ]);
  if (!byPhone.success || !byIp.success) {
    return { ok: false, error: "Too many codes requested. Please wait a minute and try again." };
  }

  const code = generateOtpCode();
  await storeOtp(phone, code);
  const sent = await sendOtpSms(phone, code);
  if (!sent) {
    return { ok: false, error: "We couldn't send the code right now. Please try again or use email." };
  }

  // Dev-only convenience: keyless mode surfaces the code in the UI toast so
  // the flow is testable without an SMS provider. Never in production.
  const devCode =
    !isConfigured.msg91() && process.env.NODE_ENV !== "production" ? code : undefined;

  return { ok: true, phone, devCode };
}

export type PhoneLoginResult = { ok: false; error: string };

/**
 * Verifies the OTP and signs the user in (creating/linking the account inside
 * the `phone-otp` provider). On success NextAuth redirects, so this only ever
 * *returns* on failure.
 */
export async function phoneOtpLoginAction(
  raw: unknown,
  callbackUrl?: string,
): Promise<PhoneLoginResult> {
  const parsed = otpVerifySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Enter the 6-digit code we sent you." };
  }

  // Brute-force guard: wrong guesses don't consume the code, so cap verify
  // attempts per phone AND per caller (5/min each; the code lives 5 minutes).
  const [byPhone, byIp] = await Promise.all([
    checkRateLimit(limiters.auth, `otp-verify:${parsed.data.phone}`),
    checkRateLimit(limiters.auth, `otp-verify:${await clientIdentifier()}`),
  ]);
  if (!byPhone.success || !byIp.success) {
    return { ok: false, error: "Too many attempts. Please wait a minute, then request a fresh code." };
  }

  try {
    await signIn("phone-otp", {
      phone: parsed.data.phone,
      code: parsed.data.code,
      redirectTo: safeRedirectPath(callbackUrl, "/account"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "That code didn't match (or expired). Request a new one and try again." };
    }
    throw error; // success = NEXT_REDIRECT — must bubble up
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}
