import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { guardSection } from "@/lib/admin-guard";
import { getAdminAffiliate } from "@/lib/queries/affiliate";
import { Badge } from "@/components/ui/badge";
import { AffiliateDetailActions } from "@/components/admin/affiliate-detail-actions";
import { formatPrice, formatDate } from "@/lib/format";
import {
  AFFILIATE_ROLE_LABEL,
  AFFILIATE_STATUS_LABEL,
  COMMISSION_STATUS_LABEL,
} from "@/lib/affiliate/labels";

export const metadata: Metadata = { title: "Affiliate", robots: { index: false } };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardSection("affiliates");
  const { id } = await params;
  const data = await getAdminAffiliate(id);
  if (!data) notFound();
  const { affiliate: a, balances, stats } = data;

  const commissionLabel = a.commissionType
    ? a.commissionType === "PERCENT"
      ? `${a.commissionValue}%`
      : formatPrice(a.commissionValue ?? 0)
    : "Role / store default";

  return (
    <div className="space-y-5">
      <Link
        href="/admin/affiliates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to affiliates
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{a.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {AFFILIATE_ROLE_LABEL[a.role]} · <span className="font-mono">{a.code}</span> ·{" "}
            {a.user.email}
          </p>
        </div>
        <Badge variant={a.status === "APPROVED" ? "default" : a.status === "PENDING" ? "secondary" : "destructive"}>
          {AFFILIATE_STATUS_LABEL[a.status]}
        </Badge>
      </div>

      <AffiliateDetailActions
        affiliateId={a.id}
        status={a.status}
        hasCoupon={!!a.couponId}
        commissionType={a.commissionType}
        commissionValue={a.commissionValue}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clicks" value={String(stats.clicks)} />
        <Stat label="Orders" value={String(stats.orders)} />
        <Stat label="Revenue" value={formatPrice(stats.revenue)} />
        <Stat label="Available" value={formatPrice(balances.available)} />
        <Stat label="Pending commission" value={formatPrice(balances.pending)} />
        <Stat label="Approved" value={formatPrice(balances.approved)} />
        <Stat label="Paid" value={formatPrice(balances.paid)} />
        <Stat label="Commission rate" value={commissionLabel} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Commissions */}
        <div className="rounded-2xl border p-5">
          <h2 className="mb-3 font-semibold">Recent commissions</h2>
          {a.commissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No commissions yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {a.commissions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">#{c.order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
                  </div>
                  <Badge variant={c.status === "PAID" || c.status === "APPROVED" ? "default" : c.status === "CANCELLED" ? "destructive" : "secondary"}>
                    {COMMISSION_STATUS_LABEL[c.status]}
                  </Badge>
                  <span className="font-semibold">{formatPrice(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Profile + coupon */}
        <aside className="space-y-4">
          <div className="rounded-2xl border p-5 text-sm">
            <h2 className="mb-2 font-semibold">Profile</h2>
            {a.bio && <p className="text-muted-foreground">{a.bio}</p>}
            {a.website && (
              <p className="mt-1">
                <span className="text-muted-foreground">Web:</span>{" "}
                <a href={a.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {a.website}
                </a>
              </p>
            )}
            {a.audienceSize != null && (
              <p className="mt-1 text-muted-foreground">Audience: {a.audienceSize.toLocaleString("en-IN")}</p>
            )}
            {a.pitch && <p className="mt-2 text-muted-foreground">&ldquo;{a.pitch}&rdquo;</p>}
          </div>

          <div className="rounded-2xl border p-5 text-sm">
            <h2 className="mb-2 font-semibold">Coupon</h2>
            {a.coupon ? (
              <p>
                <span className="font-mono font-semibold text-primary">{a.coupon.code}</span> ·{" "}
                {a.coupon.type === "PERCENT" ? `${a.coupon.value}%` : formatPrice(a.coupon.value)} off ·{" "}
                {a.coupon.usedCount} uses
              </p>
            ) : (
              <p className="text-muted-foreground">No coupon yet (created on approval).</p>
            )}
          </div>

          {a.payoutMethod && (
            <div className="rounded-2xl border p-5 text-sm">
              <h2 className="mb-2 font-semibold">Payout details</h2>
              <p className="text-muted-foreground">Method: {a.payoutMethod.replace(/_/g, " ")}</p>
              {a.upiId && <p className="text-muted-foreground">UPI: {a.upiId}</p>}
              {a.bankAccount && (
                <p className="text-muted-foreground">
                  {a.accountName} · {a.bankName} · {a.bankAccount} · {a.bankIfsc}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
