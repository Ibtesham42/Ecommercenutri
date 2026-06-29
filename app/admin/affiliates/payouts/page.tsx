import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import {
  AffiliatePayoutsManager,
  type PayoutRow,
} from "@/components/admin/affiliate-payouts-manager";
import { getAdminPayouts } from "@/lib/queries/affiliate";

export const metadata: Metadata = { title: "Affiliate payouts", robots: { index: false } };

export default async function AffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await guardSection("affiliates");
  const { status } = await searchParams;
  const payouts = await getAdminPayouts(status);

  const rows: PayoutRow[] = payouts.map((p) => ({
    id: p.id,
    payoutNumber: p.payoutNumber,
    amount: p.amount,
    status: p.status,
    method: p.method,
    reference: p.reference,
    createdAt: p.createdAt.toISOString(),
    affiliate: {
      code: p.affiliate.code,
      displayName: p.affiliate.displayName,
      payoutMethod: p.affiliate.payoutMethod,
      upiId: p.affiliate.upiId,
      bankAccount: p.affiliate.bankAccount,
      bankIfsc: p.affiliate.bankIfsc,
      bankName: p.affiliate.bankName,
      accountName: p.affiliate.accountName,
      user: { email: p.affiliate.user.email },
    },
  }));

  return (
    <div>
      <PageHeader title="Payouts" description={`${rows.length} payout request${rows.length === 1 ? "" : "s"}`} />
      <AffiliateTabs />
      <AffiliatePayoutsManager payouts={rows} />
    </div>
  );
}
