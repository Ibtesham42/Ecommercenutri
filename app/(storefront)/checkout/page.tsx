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
    <div className="shop-container pt-6 pb-28 sm:pt-8 lg:pb-24">
      {/* Funnel signal; remounts may re-fire — analytics counts distinct shoppers. */}
      <BehaviorTracker event={{ type: "CHECKOUT_START" }} />
      <header className="mb-5 sm:mb-6">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="mt-2 font-heading text-title text-foreground sm:mt-3">Checkout</h1>
      </header>
      <CheckoutClient
        addresses={data}
        razorpayEnabled={razorpayEnabled}
        userName={user.name ?? ""}
        settings={settings}
      />
    </div>
  );
}
