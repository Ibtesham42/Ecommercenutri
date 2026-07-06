"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  profileSchema,
  addressSchema,
  emailChangeSchema,
  passwordChangeSchema,
  avatarSchema,
} from "@/lib/validations/account";
import { normalizeIndianPhone, otpRequestSchema, otpVerifySchema } from "@/lib/validations/auth";
import { generateOtpCode, sendOtpSms, storeOtp, verifyOtp } from "@/lib/otp";
import { env, isConfigured } from "@/lib/env";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { createVerificationToken } from "@/lib/tokens";
import { transitionOrderStatus } from "@/lib/orders";
import { isCustomerCancellable } from "@/lib/order-status";
import { orderStatusEmail, verificationEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";

export type AccountState = { error?: string; success?: string } | undefined;

export async function updateProfile(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    gender: formData.get("gender") || undefined,
    dob: formData.get("dob") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      gender: parsed.data.gender ?? null,
      dob: parsed.data.dob ? new Date(`${parsed.data.dob}T00:00:00Z`) : null,
    },
  });
  revalidatePath("/account");
  return { success: "Profile updated." };
}

/** Changes the account email (uniqueness-checked) and re-triggers verification. */
export async function updateEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = emailChangeSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const email = parsed.data.email.trim().toLowerCase();

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  if (!current) return { error: "Not signed in." };
  if (current.email === email) return { success: "That's already your email." };

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) return { error: "That email is already in use on another account." };

  await prisma.user.update({
    where: { id: user.id },
    data: { email, emailVerified: null },
  });

  // Best-effort verification link — never fail the update over email delivery.
  try {
    const token = await createVerificationToken(email);
    const url = `${env.appUrl}/verify-email?token=${token}`;
    await sendEmail({ to: email, ...verificationEmail(url, user.name ?? null) });
  } catch (mailErr) {
    console.error("[account] verification email failed:", mailErr);
  }

  revalidatePath("/account");
  return { success: "Email updated — check your inbox for a verification link." };
}

/** Sets a password (phone/Google accounts) or changes it (current required). */
export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword") || undefined,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Not signed in." };

  if (record.passwordHash) {
    if (!parsed.data.currentPassword) {
      return { error: "Enter your current password." };
    }
    const ok = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
    if (!ok) return { error: "Your current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return {
    success: record.passwordHash ? "Password changed." : "Password set — you can now sign in with email too.",
  };
}

/** Saves the Cloudinary avatar URL set by the direct browser upload. */
export async function updateAvatar(url: unknown): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = avatarSchema.safeParse(url);
  if (!parsed.success) return { error: "Invalid image." };

  await prisma.user.update({
    where: { id: user.id },
    data: { image: parsed.data || null },
  });
  revalidatePath("/account");
  return { success: parsed.data ? "Photo updated." : "Photo removed." };
}

export type ProfileOtpResult =
  | { ok: true; phone: string; devCode?: string }
  | { ok: false; error: string };

/** Sends a verification OTP for changing the account's phone number. */
export async function requestProfilePhoneOtp(raw: unknown): Promise<ProfileOtpResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = otpRequestSchema.safeParse(raw);
  const phone = parsed.success ? normalizeIndianPhone(parsed.data.phone) : null;
  if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };

  const taken = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (taken && taken.id !== user.id) {
    return { ok: false, error: "That number is already linked to another account." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "anon";
  const [byPhone, byIp] = await Promise.all([
    checkRateLimit(limiters.auth, `otp:${phone}`),
    checkRateLimit(limiters.auth, `otp:${ip}`),
  ]);
  if (!byPhone.success || !byIp.success) {
    return { ok: false, error: "Too many codes requested. Please wait a minute." };
  }

  const code = generateOtpCode();
  await storeOtp(phone, code);
  const sent = await sendOtpSms(phone, code);
  if (!sent) return { ok: false, error: "We couldn't send the code right now. Please try again." };

  const devCode =
    !isConfigured.msg91() && process.env.NODE_ENV !== "production" ? code : undefined;
  return { ok: true, phone, devCode };
}

/** Verifies the OTP and links the phone to the signed-in account. */
export async function confirmProfilePhone(raw: unknown): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = otpVerifySchema.safeParse(raw);
  const phone = parsed.success ? normalizeIndianPhone(parsed.data.phone) : null;
  if (!phone || !parsed.success) return { error: "Enter the 6-digit code." };

  const valid = await verifyOtp(phone, parsed.data.code);
  if (!valid) return { error: "That code didn't match (or expired). Request a new one." };

  const taken = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (taken && taken.id !== user.id) {
    return { error: "That number is already linked to another account." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { phone, phoneVerified: new Date() },
  });
  revalidatePath("/account");
  return { success: "Phone number verified." };
}

export async function saveAddress(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const parsed = addressSchema.safeParse({
    id: formData.get("id") || undefined,
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    type: formData.get("type") || "HOME",
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { id, isDefault, ...fields } = parsed.data;

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  if (id) {
    await prisma.address.updateMany({
      where: { id, userId: user.id },
      data: { ...fields, isDefault: isDefault ?? undefined },
    });
  } else {
    const count = await prisma.address.count({ where: { userId: user.id } });
    await prisma.address.create({
      data: { ...fields, userId: user.id, isDefault: isDefault || count === 0 },
    });
  }

  revalidatePath("/account/addresses");
  return { success: "Address saved." };
}

export async function deleteAddress(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function setDefaultAddress(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.address.updateMany({
    where: { userId: user.id },
    data: { isDefault: false },
  });
  await prisma.address.updateMany({
    where: { id, userId: user.id },
    data: { isDefault: true },
  });
  revalidatePath("/account/addresses");
}

// --- Order cancellation (customer) ------------------------------------------

const cancelOrderSchema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Customer-initiated cancellation. Allowed only while the order is still PENDING
 * (before the admin approves it); the shared `transitionOrderStatus` restocks
 * inventory and records the timeline event + reason.
 */
export async function cancelOrder(input: unknown): Promise<CancelOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (!isCustomerCancellable(order.status)) {
    return {
      ok: false,
      error: "This order can no longer be cancelled. Please contact support.",
    };
  }

  const reason = parsed.data.reason || "Cancelled by customer";
  const updated = await transitionOrderStatus(order.id, "CANCELLED", {
    reason,
    actor: "customer",
  });

  // Notify the customer (best-effort).
  if (updated?.user?.email) {
    const mail = orderStatusEmail({
      orderNumber: updated.orderNumber,
      status: "CANCELLED",
      name: updated.user.name,
      reason,
    });
    if (mail) {
      try {
        await sendEmail({ to: updated.user.email, ...mail });
      } catch (err) {
        console.error("[account] cancel email failed:", err);
      }
    }
  }

  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
