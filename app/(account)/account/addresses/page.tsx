import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AddressManager,
} from "@/components/account/address-manager";
import type { AddressData } from "@/components/account/address-form";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  const rows = await prisma.address.findMany({
    where: { userId: user!.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const addresses: AddressData[] = rows.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    type: a.type,
    isDefault: a.isDefault,
  }));

  return <AddressManager addresses={addresses} />;
}
