import "server-only";

import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { env, isConfigured } from "@/lib/env";

/**
 * Phone login OTPs. Codes are 6-digit, live 5 minutes, and are stored ONLY as
 * a salted hash in the NextAuth `VerificationToken` table (identifier
 * `phone-otp:<+91XXXXXXXXXX>`), so a DB leak never exposes live codes.
 *
 * Delivery is MSG91 (DLT OTP template). Keyless fallback: outside production
 * the code is logged to the server console so the flow stays fully testable —
 * in production without MSG91 keys, phone login is hidden entirely
 * (see `isPhoneAuthEnabled`).
 */

const OTP_TTL_MS = 5 * 60_000;

/** Phone login is offered when OTPs can actually be delivered (or in dev). */
export function isPhoneAuthEnabled(): boolean {
  return isConfigured.msg91() || process.env.NODE_ENV !== "production";
}

function identifierFor(phone: string) {
  return `phone-otp:${phone}`;
}

function hashOtp(phone: string, code: string) {
  return createHash("sha256")
    .update(`${phone}:${code}:${env.authSecret}`)
    .digest("hex");
}

/** Crypto-random 6-digit code (never starts the flow with Math.random). */
export function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** Replaces any previous code for this phone — only the newest OTP is valid. */
export async function storeOtp(phone: string, code: string): Promise<void> {
  const identifier = identifierFor(phone);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashOtp(phone, code),
      expires: new Date(Date.now() + OTP_TTL_MS),
    },
  });
}

/** One-shot verify: a matching, unexpired code is consumed immediately. */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const identifier = identifierFor(phone);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashOtp(phone, code) },
  });
  if (!record || record.identifier !== identifier) return false;
  // Consume win or lose on expiry — a stale code can't be retried either way.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  return record.expires >= new Date();
}

/**
 * Sends the OTP via MSG91's OTP API. Returns true when the code is on its way
 * (or when running keyless outside production, where it's console-logged).
 */
export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  if (!isConfigured.msg91()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[otp] MSG91 not configured — dev OTP for ${phone}: ${code}`);
      return true;
    }
    return false;
  }

  try {
    const mobile = phone.replace(/\D/g, ""); // MSG91 wants 91XXXXXXXXXX
    const res = await fetch(
      `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(env.msg91TemplateId)}&mobile=${mobile}&otp=${code}`,
      {
        method: "POST",
        headers: { authkey: env.msg91AuthKey, "Content-Type": "application/json" },
        cache: "no-store",
      },
    );
    const body = (await res.json().catch(() => null)) as { type?: string } | null;
    if (!res.ok || body?.type !== "success") {
      console.error("[otp] MSG91 send failed:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[otp] MSG91 send error:", err);
    return false;
  }
}
