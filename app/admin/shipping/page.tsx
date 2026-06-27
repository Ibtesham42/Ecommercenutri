import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { ShippingForm, type ShippingValues } from "@/components/admin/shipping-form";
import { prisma } from "@/lib/prisma";
import { PRICING_DEFAULTS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Shipping", robots: { index: false } };

const toRupees = (paise: number | null | undefined) =>
  paise == null ? null : paise / 100;

export default async function AdminShippingPage() {
  await guardSection("appearance");

  const raw = await prisma.storeSetting.findUnique({ where: { id: "singleton" } });

  const initial: ShippingValues = {
    freeShippingEnabled: raw?.freeShippingEnabled ?? PRICING_DEFAULTS.freeShippingEnabled,
    defaultShippingFee:
      (raw?.defaultShippingFee ?? PRICING_DEFAULTS.defaultShippingFee) / 100,
    freeShippingThreshold:
      (raw?.freeShippingThreshold ?? PRICING_DEFAULTS.freeShippingThreshold) / 100,
    localDeliveryFee: toRupees(raw?.localDeliveryFee),
    expressDeliveryFee: toRupees(raw?.expressDeliveryFee),
    codFee: toRupees(raw?.codFee),
    codEnabled: raw?.codEnabled ?? false,
    codMinOrder: toRupees(raw?.codMinOrder),
    codMaxOrder: toRupees(raw?.codMaxOrder),
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shipping &amp; delivery"
        description="The single source of truth for delivery charges across the storefront, cart, checkout, orders and invoices."
      />
      <ShippingForm initial={initial} />
    </div>
  );
}
