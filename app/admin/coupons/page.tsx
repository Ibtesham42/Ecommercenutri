import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { CouponManager, type CouponRow } from "@/components/admin/coupon-manager";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Coupons", robots: { index: false } };

export default async function AdminCouponsPage() {
  await guardSection("coupons");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    perUserLimit: c.perUserLimit,
    startsAt: c.startsAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
  }));

  return (
    <div>
      <PageHeader title="Coupons" description="Create and manage discount codes." />
      <CouponManager coupons={rows} />
    </div>
  );
}
