"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema, addressSchema } from "@/lib/validations/account";

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
