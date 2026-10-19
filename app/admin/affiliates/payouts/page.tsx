import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import {
  AffiliatePayoutsManager,
  type PayoutRow,
} from "@/components/admin/affiliate-payouts-manager";
import { getAdminPayouts } from "@/lib/queries/affiliate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliate payouts", robots: { index: false } };

const FILTERS = [
  { value: "", label: "All" },
  { value: "REQUESTED", label: "To review" },
  { value: "APPROVED", label: "To pay" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
];

export default async function AffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await guardSection("affiliates");
  const { status = "" } = await searchParams;
  const payouts = await getAdminPayouts(status);

  const rows: PayoutRow[] = payouts.map((p) => ({
    id: p.id,
    payoutNumber: p.payoutNumber,
    amount: p.amount,
    status: p.status,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    commissions: p._count.commissions,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    affiliate: {
      id: p.affiliate.id,
      code: p.affiliate.code,
      displayName: p.affiliate.displayName,
      status: p.affiliate.status,
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
      <PageHeader
        title="Payouts"
        description="Review requests, send the money from your bank or UPI app, then record the transfer reference here."
      />
      <AffiliateTabs />
      <nav aria-label="Filter payouts" className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/affiliates/payouts${f.value ? `?status=${f.value}` : ""}`}
            aria-current={status === f.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              status === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <AffiliatePayoutsManager payouts={rows} />
    </div>
  );
}
