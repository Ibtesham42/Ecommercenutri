import type { Metadata } from "next";
import { Megaphone, Download, Clock, Ban } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getMyAffiliate,
  getAffiliateDashboard,
  getMarketingAssets,
} from "@/lib/queries/affiliate";
import { matureCommissions } from "@/lib/affiliate/commissions";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { referralUrl } from "@/lib/affiliate/codes";
import { AffiliateApplyForm } from "@/components/account/affiliate/affiliate-apply-form";
import { AffiliateReferralCard } from "@/components/account/affiliate/affiliate-referral-card";
import { AffiliatePayoutPanel } from "@/components/account/affiliate/affiliate-payout-panel";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { statusLabel, statusBadgeVariant } from "@/lib/order-status";
import {
  AFFILIATE_ROLE_LABEL,
  COMMISSION_STATUS_LABEL,
  PAYOUT_STATUS_LABEL,
  MARKETING_ASSET_LABEL,
} from "@/lib/affiliate/labels";

export const metadata: Metadata = { title: "Affiliate program" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AffiliatePage() {
  const user = await getCurrentUser();
  const settings = await getAffiliateSettings();
  const affiliate = user?.id ? await getMyAffiliate(user.id) : null;

  // --- Not enrolled / rejected → application ---
  if (!affiliate || affiliate.status === "REJECTED") {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Become a Nutriyet partner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn commission on every sale you refer, with your own link, QR code and coupon.
          </p>
        </div>
        {affiliate?.status === "REJECTED" && affiliate.rejectionReason && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            Your previous application was declined: {affiliate.rejectionReason}. You&rsquo;re
            welcome to apply again.
          </div>
        )}
        {settings.affiliateEnabled ? (
          <AffiliateApplyForm defaultName={user?.name} />
        ) : (
          <p className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            The affiliate program isn&rsquo;t accepting applications right now. Check back soon.
          </p>
        )}
      </div>
    );
  }

  // --- Pending / suspended ---
  if (affiliate.status === "PENDING") {
    return (
      <div className="max-w-xl rounded-2xl border bg-muted/20 p-8 text-center">
        <Clock className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Application under review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks for applying as a {AFFILIATE_ROLE_LABEL[affiliate.role]}. We&rsquo;ll email you
          once it&rsquo;s approved — usually within a couple of days.
        </p>
      </div>
    );
  }
  if (affiliate.status === "SUSPENDED") {
    return (
      <div className="max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <Ban className="mx-auto size-10 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">Account suspended</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {affiliate.suspendReason || "Your affiliate account is currently suspended."} Please
          contact support if you think this is a mistake.
        </p>
      </div>
    );
  }

  // --- Approved → dashboard ---
  await matureCommissions(); // lazy sweep so balances are current
  const [data, assets] = await Promise.all([
    getAffiliateDashboard({ id: affiliate.id, couponId: affiliate.couponId }),
    getMarketingAssets(),
  ]);
  const url = referralUrl(affiliate.code);
  const maxCommission = Math.max(1, ...data.monthly.map((m) => m.commission));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Affiliate dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {AFFILIATE_ROLE_LABEL[affiliate.role]} · code <span className="font-mono">{affiliate.code}</span>
          </p>
        </div>
        <Badge>Active</Badge>
      </div>

      <AffiliateReferralCard referralUrl={url} couponCode={data.coupon?.code ?? null} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Clicks" value={String(data.clicks)} />
        <Stat label="Unique visitors" value={String(data.uniqueVisitors)} />
        <Stat label="Orders" value={String(data.orders)} />
        <Stat label="Conversion" value={`${(data.conversion * 100).toFixed(1)}%`} />
        <Stat label="Revenue generated" value={formatPrice(data.revenue)} />
        <Stat label="Coupon uses" value={String(data.coupon?.usedCount ?? 0)} />
        <Stat label="Pending commission" value={formatPrice(data.balances.pending)} />
        <Stat
          label="Approved commission"
          value={formatPrice(data.balances.approved)}
          hint={`Paid: ${formatPrice(data.balances.paid)}`}
        />
      </div>

      {/* Monthly performance */}
      <div className="rounded-2xl border p-5">
        <h2 className="mb-4 font-semibold">Monthly performance</h2>
        <div className="flex items-end gap-3">
          {data.monthly.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center">
                <div
                  className="w-7 rounded-t bg-primary/80 transition-all"
                  style={{ height: `${Math.max(2, (m.commission / maxCommission) * 100)}%` }}
                  title={`${m.month}: ${formatPrice(m.commission)} · ${m.orders} orders · ${m.clicks} clicks`}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Commission earned per month</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Recent referred orders */}
        <div className="rounded-2xl border p-5">
          <h2 className="mb-3 font-semibold">Recent referred orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No referred orders yet — share your link to start earning.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {data.recentOrders.map((o) => (
                <li key={o.orderNumber} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">#{o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                  </div>
                  <Badge variant={statusBadgeVariant[o.status] ?? "secondary"}>
                    {statusLabel(o.status)}
                  </Badge>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(o.commission?.amount ?? 0)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.commission ? COMMISSION_STATUS_LABEL[o.commission.status] : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payouts */}
        <div className="space-y-4">
          <AffiliatePayoutPanel
            available={data.balances.available}
            minPayout={settings.affiliateMinPayout}
            initial={{
              payoutMethod: affiliate.payoutMethod ?? "UPI",
              upiId: affiliate.upiId ?? "",
              bankName: affiliate.bankName ?? "",
              bankAccount: affiliate.bankAccount ?? "",
              bankIfsc: affiliate.bankIfsc ?? "",
              accountName: affiliate.accountName ?? "",
            }}
          />
          {data.payouts.length > 0 && (
            <div className="rounded-2xl border p-5">
              <h2 className="mb-3 font-semibold">Payout history</h2>
              <ul className="divide-y text-sm">
                {data.payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{p.payoutNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                    </div>
                    <Badge variant={p.status === "PAID" ? "default" : "secondary"}>
                      {PAYOUT_STATUS_LABEL[p.status]}
                    </Badge>
                    <span className="font-semibold">{formatPrice(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Marketing kit */}
      <div className="rounded-2xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-primary" /> Marketing kit
        </h2>
        {assets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No marketing assets yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border">
                <div className="aspect-video bg-accent/30">
                  {a.thumbnailUrl || /\.(png|jpe?g|webp|gif)$/i.test(a.fileUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnailUrl || a.fileUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Megaphone className="size-6" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-xs font-medium">{a.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {MARKETING_ASSET_LABEL[a.type]}
                    </span>
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <Download className="size-3" /> Get
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
