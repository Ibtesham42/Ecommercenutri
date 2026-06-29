import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import {
  AffiliateCommissionsManager,
  type CommissionRow,
} from "@/components/admin/affiliate-commissions-manager";
import { getAdminCommissions } from "@/lib/queries/affiliate";

export const metadata: Metadata = { title: "Affiliate commissions", robots: { index: false } };

export default async function AffiliateCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await guardSection("affiliates");
  const { status = "ALL", search = "" } = await searchParams;
  const { commissions, summary } = await getAdminCommissions({ status, search });

  const rows: CommissionRow[] = commissions.map((c) => ({
    id: c.id,
    amount: c.amount,
    base: c.base,
    status: c.status,
    matureAt: c.matureAt ? c.matureAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    order: { orderNumber: c.order.orderNumber, status: c.order.status },
    affiliate: {
      id: c.affiliate.id,
      code: c.affiliate.code,
      displayName: c.affiliate.displayName,
    },
  }));

  return (
    <div>
      <PageHeader title="Commissions" description="Track and manage affiliate commissions" />
      <AffiliateTabs />
      <AffiliateCommissionsManager
        commissions={rows}
        summary={summary}
        status={status}
        search={search}
      />
    </div>
  );
}
