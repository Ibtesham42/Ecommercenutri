"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import {
  createPasswordResetToken,
  createVerificationToken,
} from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verificationEmail, passwordResetEmail } from "@/lib/emails";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type AuthActionState = { error?: string; success?: string } | undefined;

async function clientIdentifier(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "anon"
  );
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, email, password } = parsed.data;

  const { success } = await checkRateLimit(
    limiters.auth,
    `register:${await clientIdentifier()}`,
  );
  if (!success) return { error: "Too many attempts. Please try again later." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, passwordHash } });

    // Best-effort verification email — a misconfigured/unverified email provider
    // must never crash a successful sign-up (the account already exists).
    try {
      const token = await createVerificationToken(email);
      const url = `${env.appUrl}/verify-email?token=${token}`;
      await sendEmail({ to: email, ...verificationEmail(url, name) });
    } catch (mailErr) {
      console.error("[register] verification email failed:", mailErr);
    }

    return {
      success: "Account created! You can sign in now (check your email for a verification link).",
    };
  } catch (err) {
    console.error("[register] failed:", err);
    return { error: "Could not create your account right now. Please try again." };
  }
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password." };

  const { success } = await checkRateLimit(
    limiters.auth,
    `login:${await clientIdentifier()}`,
  );
  if (!success) return { error: "Too many attempts. Please try again later." };

  const callbackUrl = (formData.get("callbackUrl") as string) || "/account";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // signIn throws a redirect on success — must be rethrown.
    throw error;
  }
  return undefined;
}

export async function googleSignInAction(callbackUrl?: string) {
  await signIn("google", { redirectTo: callbackUrl || "/account" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "Enter a valid email." };
  const { email } = parsed.data;

  const { success } = await checkRateLimit(
    limiters.auth,
    `forgot:${await clientIdentifier()}`,
  );
  if (!success) return { error: "Too many attempts. Please try again later." };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await createPasswordResetToken(email);
      const url = `${env.appUrl}/reset-password?token=${token}`;
      // Best-effort — never surface an email/provider failure to the user.
      try {
        await sendEmail({ to: email, ...passwordResetEmail(url, user.name) });
      } catch (mailErr) {
        console.error("[forgot-password] reset email failed:", mailErr);
      }
    }
  } catch (err) {
    console.error("[forgot-password] failed:", err);
  }

  // Always return success to avoid leaking which emails are registered.
  return {
    success: "If an account exists for that email, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });
  if (!record || record.expires < new Date()) {
    return { error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { email: record.email },
    data: { passwordHash },
  });
  await prisma.passwordResetToken.deleteMany({ where: { email: record.email } });

  return {
    success: "Password updated! You can now sign in with your new password.",
  };
}

/** Called by the verify-email page (server). */
export async function verifyEmailToken(
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!record || record.expires < new Date()) {
    return {
      ok: false,
      message: "This verification link is invalid or has expired.",
    };
  }
  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier },
  });
  return { ok: true, message: "Your email has been verified. You can now sign in." };
}
