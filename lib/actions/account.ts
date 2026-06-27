"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema, addressSchema } from "@/lib/validations/account";
import { transitionOrderStatus } from "@/lib/orders";
import { isCustomerCancellable } from "@/lib/order-status";
import { orderStatusEmail } from "@/lib/emails";
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
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
  });
  revalidatePath("/account");
  return { success: "Profile updated." };
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
