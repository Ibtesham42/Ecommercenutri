import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Create (and replace any existing) email-verification token for an address. */
export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 24 * HOUR);
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });
  return token;
}

/** Create (and replace any existing) password-reset token for an address. */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 1 * HOUR);
  await prisma.passwordResetToken.deleteMany({ where: { email } });
  await prisma.passwordResetToken.create({ data: { email, token, expires } });
  return token;
}
