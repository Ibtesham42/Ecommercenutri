import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { razorpayEnabled } from "@/lib/razorpay";
import { getPricingSettings } from "@/lib/queries/settings";
import { CheckoutClient } from "@/components/storefront/checkout-client";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
import type { AddressData } from "@/components/account/address-form";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  path: "/checkout",
  noindex: true,
});

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/checkout");

  const [addresses, settings] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    getPricingSettings(),
  ]);

  const data: AddressData[] = addresses.map((a) => ({
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* Funnel signal; remounts may re-fire — analytics counts distinct shoppers. */}
      <BehaviorTracker event={{ type: "CHECKOUT_START" }} />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Checkout</h1>
      <CheckoutClient
        addresses={data}
        razorpayEnabled={razorpayEnabled}
        userName={user.name ?? ""}
        settings={settings}
      />
    </div>
  );
}
