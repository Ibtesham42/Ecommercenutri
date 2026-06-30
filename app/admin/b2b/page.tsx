import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { B2BManager, type B2BRow } from "@/components/admin/b2b-manager";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "B2B Inquiries", robots: { index: false } };

export default async function AdminB2BPage() {
  await guardSection("customers");

  const inquiries = await prisma.b2BInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows: B2BRow[] = inquiries.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    companyName: r.companyName,
    businessType: r.businessType,
    phone: r.phone,
    email: r.email,
    city: r.city,
    state: r.state,
    country: r.country,
    purpose: r.purpose,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="B2B Inquiries"
        description="Wholesale & business inquiries submitted through the B2B page — separate from contact messages."
      />
      <B2BManager inquiries={rows} />
    </div>
  );
}
