import type { Metadata } from "next";
import { Megaphone, Download, Clock, Ban } from "lucide-react";
import type { CommissionStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  getMyAffiliate,
  getAffiliateDashboard,
  getMarketingAssets,
  getEarningTerms,
  type EarningTerms,
} from "@/lib/queries/affiliate";
import { affiliateBalances, matureCommissions } from "@/lib/affiliate/commissions";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { referralUrl } from "@/lib/affiliate/codes";
import { AffiliateApplyForm } from "@/components/account/affiliate/affiliate-apply-form";
import { AffiliateReferralCard } from "@/components/account/affiliate/affiliate-referral-card";
import { AffiliatePayoutPanel } from "@/components/account/affiliate/affiliate-payout-panel";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { AFFILIATE_ROLE_LABEL, PAYOUT_STATUS_LABEL, MARKETING_ASSET_LABEL } from "@/lib/affiliate/labels";
import { payoutRejectionReason } from "@/lib/affiliate/payout-audit";

export const metadata: Metadata = { title: "Affiliate program" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function rateText(t: EarningTerms): string {
  return t.rate.type === "PERCENT"
    ? `${t.rate.value}% of the item value`
    : `${formatPrice(t.rate.value)} per item sold`;
}

/** The program's real rules in plain language — shown to applicants and partners. */
function EarningTermsList({ terms }: { terms: EarningTerms }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      <li>
        <span className="font-medium text-foreground">You earn {rateText(terms)}</span> on orders placed
        through your link or coupon — after discounts, not counting shipping.
        {terms.hasSpecialRates && " Some products carry their own rate."} Your own orders don&rsquo;t
        count.
      </li>
      <li>
        Your link remembers a visitor for <span className="text-foreground">{terms.cookieDays} days</span>. If
        they use a partner&rsquo;s coupon, that partner gets the credit.
      </li>
      <li>
        Commission becomes payable once the order is delivered and its{" "}
        <span className="text-foreground">{terms.returnWindowDays}-day return window</span> has passed.
        Cancelled or returned items don&rsquo;t earn.
      </li>
      <li>
        Withdraw to UPI or your bank once you have{" "}
        <span className="text-foreground">{formatPrice(terms.minPayout)}</span> ready.
      </li>
    </ul>
  );
}

/** Plain-language state of one referred order's commission. */
function commissionState(
  c: { status: CommissionStatus; matureAt: Date | null },
): { label: string; tone: "default" | "secondary" | "outline" | "destructive" } {
  switch (c.status) {
    case "PENDING":
      return c.matureAt
        ? { label: `Payable from ${formatDate(c.matureAt)}`, tone: "secondary" }
        : { label: "Waiting for delivery", tone: "secondary" };
    case "APPROVED":
      return { label: "Ready to withdraw", tone: "outline" };
    case "PAID":
      return { label: "Paid", tone: "default" };
    case "CANCELLED":
      return { label: "Cancelled or returned", tone: "destructive" };
  }
}

export default async function AffiliatePage() {
  const user = await getCurrentUser();
  const settings = await getAffiliateSettings();
  const affiliate = user?.id ? await getMyAffiliate(user.id) : null;

  // --- Not enrolled / rejected → application ---
  if (!affiliate || affiliate.status === "REJECTED") {
    const terms = await getEarningTerms(null);
    return (
      <div className="max-w-2xl space-y-5">
        <div>
          <h2 className="font-heading text-subheading font-medium">Become a Nutriyet partner</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn commission on every sale you refer, with your own link, QR code and coupon.
          </p>
        </div>
        {affiliate?.status === "REJECTED" && affiliate.rejectionReason && (
          <div role="status" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            Your previous application was declined: {affiliate.rejectionReason}. You&rsquo;re welcome to
            apply again.
          </div>
        )}
        {settings.affiliateEnabled ? (
          <>
            <section aria-labelledby="terms-h" className="rounded-xl border bg-muted/20 p-5">
              <h3 id="terms-h" className="mb-3 text-sm font-semibold">
                Program terms
              </h3>
              <EarningTermsList terms={terms} />
            </section>
            <AffiliateApplyForm defaultName={user?.name} />
          </>
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
      <div role="status" className="max-w-xl rounded-xl border bg-muted/20 p-8 text-center">
        <Clock className="mx-auto size-10 text-primary" aria-hidden />
        <h2 className="mt-3 font-heading text-subheading font-medium">Application under review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks for applying as a {AFFILIATE_ROLE_LABEL[affiliate.role]} on {formatDate(affiliate.createdAt)}.
          We&rsquo;ll email you once it&rsquo;s reviewed — usually within a couple of days.
        </p>
      </div>
    );
  }
  if (affiliate.status === "SUSPENDED") {
    // Earned commissions are kept (and still mature); they just can't be withdrawn
    // while suspended. Shown so the partner knows nothing was taken away.
    const kept = await affiliateBalances(affiliate.id);
    return (
      <div role="status" className="max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <Ban className="mx-auto size-10 text-destructive" aria-hidden />
        <h2 className="mt-3 font-heading text-subheading font-medium">Account suspended</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {affiliate.suspendReason || "Your affiliate account is currently suspended."} While suspended, your
          link and coupon don&rsquo;t earn commission. Please contact support if you think this is a mistake.
        </p>
        {kept.pending + kept.approved > 0 && (
          <p className="mt-3 text-sm">
            Your earned commission of{" "}
            <span className="font-semibold">{formatPrice(kept.pending + kept.approved)}</span> is kept and can be
            withdrawn if your account is reactivated.
          </p>
        )}
      </div>
    );
  }

  // --- Approved → dashboard ---
  await matureCommissions(); // lazy sweep so balances are current
  const [data, assets, terms] = await Promise.all([
    getAffiliateDashboard({ id: affiliate.id, couponId: affiliate.couponId }),
    getMarketingAssets(),
    getEarningTerms(affiliate),
  ]);
  const url = referralUrl(affiliate.code);
  const maxCommission = Math.max(1, ...data.monthly.map((m) => m.commission));
  const { balances } = data;
  const inPayout = balances.approved - balances.available;
  const openPayout = data.payouts.find((p) => ["REQUESTED", "APPROVED", "PROCESSING"].includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-subheading font-medium">Affiliate dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {affiliate.displayName} · {AFFILIATE_ROLE_LABEL[affiliate.role]}
          </p>
        </div>
        <Badge>Active partner</Badge>
      </div>

      <AffiliateReferralCard referralUrl={url} couponCode={data.coupon?.code ?? null} />

      {/* Earnings — the money view first */}
      <section aria-labelledby="earnings-h" className="space-y-3">
        <h3 id="earnings-h" className="text-sm font-semibold">
          Your earnings
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Pending" value={formatPrice(balances.pending)} hint="Payable after delivery + return window" />
          <Stat label="Ready to withdraw" value={formatPrice(balances.available)} hint="Approved and not yet requested" />
          <Stat label="In payout" value={formatPrice(inPayout)} hint="Requested, being processed" />
          <Stat label="Paid to you" value={formatPrice(balances.paid)} hint="All time" />
        </div>
      </section>

      {/* Activity */}
      <section aria-labelledby="activity-h" className="space-y-3">
        <h3 id="activity-h" className="text-sm font-semibold">
          Referral activity
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Link clicks" value={String(data.clicks)} />
          <Stat label="Unique visitors" value={String(data.uniqueVisitors)} />
          <Stat label="Referred orders" value={String(data.orders)} hint="Confirmed, not cancelled" />
          <Stat label="Customers" value={String(data.customers)} />
          <Stat label="Referred sales" value={formatPrice(data.revenue)} hint="Item value after discounts" />
          <Stat
            label="Conversion"
            value={`${(data.conversion * 100).toFixed(1)}%`}
            hint={data.coupon ? `Coupon used ${data.coupon.usedCount}×` : undefined}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Referred orders */}
          <section aria-labelledby="orders-h" className="rounded-xl border border-border p-5">
            <h3 id="orders-h" className="mb-3 font-semibold">
              Referred orders
            </h3>
            {data.recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No referred orders yet. Share your link or coupon — orders show up here as soon as they&rsquo;re
                confirmed.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {data.recentOrders.map((o) => {
                  const state = commissionState(o.commission);
                  return (
                    <li key={o.orderNumber} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">Order #{o.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(o.createdAt)} · sale {formatPrice(o.sale)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            o.commission.status === "CANCELLED"
                              ? "font-semibold text-muted-foreground line-through"
                              : "font-semibold"
                          }
                        >
                          {formatPrice(o.commission.amount)}
                        </p>
                        <Badge variant={state.tone} className="mt-1 whitespace-normal text-right">
                          {state.label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Monthly performance */}
          <section aria-labelledby="monthly-h" className="rounded-xl border border-border p-5">
            <h3 id="monthly-h" className="mb-4 font-semibold">
              Commission per month
            </h3>
            <div className="flex items-end gap-2 sm:gap-3">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                    {m.commission > 0 ? formatPrice(m.commission) : ""}
                  </span>
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className="w-full max-w-7 rounded-t bg-primary/80"
                      style={{ height: `${Math.max(2, (m.commission / maxCommission) * 100)}%` }}
                      role="img"
                      aria-label={`${m.month}: ${formatPrice(m.commission)} from ${m.orders} orders, ${m.clicks} clicks`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Payouts */}
        <div className="space-y-4">
          <AffiliatePayoutPanel
            available={balances.available}
            minPayout={terms.minPayout}
            openPayout={openPayout ? { amount: openPayout.amount, status: PAYOUT_STATUS_LABEL[openPayout.status] } : null}
            hasDetails={!!affiliate.payoutMethod}
            initial={{
              payoutMethod: affiliate.payoutMethod ?? "UPI",
              upiId: affiliate.upiId ?? "",
              bankName: affiliate.bankName ?? "",
              bankAccount: affiliate.bankAccount ?? "",
              bankIfsc: affiliate.bankIfsc ?? "",
              accountName: affiliate.accountName ?? "",
            }}
          />
          <section aria-labelledby="payouts-h" className="rounded-xl border border-border p-5">
            <h3 id="payouts-h" className="mb-3 font-semibold">
              Payout history
            </h3>
            {data.payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payouts yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.payouts.map((p) => (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums">{formatPrice(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {formatDate(p.createdAt)}
                        {p.status === "PAID" && p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                        {p.status === "PAID" && p.reference ? ` · ref ${p.reference}` : ""}
                      </p>
                      {p.status === "REJECTED" && (
                        <p className="text-xs text-muted-foreground">
                          {payoutRejectionReason(p.notes) ? `${payoutRejectionReason(p.notes)} · ` : ""}Amount returned to
                          your balance.
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={p.status === "PAID" ? "default" : p.status === "REJECTED" ? "destructive" : "secondary"}
                    >
                      {PAYOUT_STATUS_LABEL[p.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="how-h" className="rounded-xl border bg-muted/20 p-5">
            <h3 id="how-h" className="mb-3 text-sm font-semibold">
              How you earn
            </h3>
            <EarningTermsList terms={terms} />
          </section>
        </div>
      </div>

      {/* Marketing kit */}
      <section aria-labelledby="kit-h" className="rounded-xl border border-border p-5">
        <h3 id="kit-h" className="mb-3 flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-primary" aria-hidden /> Marketing kit
        </h3>
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
                    <img src={a.thumbnailUrl || a.fileUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Megaphone className="size-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-xs font-medium">{a.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{MARKETING_ASSET_LABEL[a.type]}</span>
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      aria-label={`Download ${a.title}`}
                    >
                      <Download className="size-3" aria-hidden /> Get
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
