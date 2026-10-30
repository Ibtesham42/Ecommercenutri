import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Tokens are stored as their SHA-256 so a DB read (backup, log, SQL access)
 * can't be replayed as a live reset/verify link. The raw token only ever exists
 * in the emailed URL. 256-bit random input → no salt/slow hash needed.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Create (and replace any existing) email-verification token for an address. */
export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 24 * HOUR);
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token: hashToken(token), expires },
  });
  return token;
}

/** Create (and replace any existing) password-reset token for an address. */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 1 * HOUR);
  await prisma.passwordResetToken.deleteMany({ where: { email } });
  await prisma.passwordResetToken.create({ data: { email, token: hashToken(token), expires } });
  return token;
}
