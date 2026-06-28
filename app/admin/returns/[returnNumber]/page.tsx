import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Download } from "lucide-react";
import { guardSection } from "@/lib/admin-guard";
import { getAdminReturn } from "@/lib/queries/returns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReturnActions } from "@/components/admin/return-actions";
import { formatPrice, formatDateTime } from "@/lib/format";
import { returnBadgeVariant, returnStatusLabel } from "@/lib/return-status";
import { cldUrl, isVideoUrl } from "@/lib/cld";

export const metadata: Metadata = { title: "Return details", robots: { index: false } };

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ returnNumber: string }>;
}) {
  await guardSection("returns");
  const { returnNumber } = await params;
  const ret = await getAdminReturn(returnNumber);
  if (!ret) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/returns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to returns
        </Link>
        {ret.creditNote && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/credit-notes/${ret.returnNumber}?download=1`}>
              <Download className="size-4" /> Credit note {ret.creditNote.number}
            </a>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{ret.returnNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Order{" "}
            <Link href={`/admin/orders/${ret.order.orderNumber}`} className="text-primary hover:underline">
              #{ret.order.orderNumber}
            </Link>{" "}
            · {formatDateTime(ret.createdAt)}
          </p>
        </div>
        <Badge variant={returnBadgeVariant[ret.status]} className="text-sm">
          {returnStatusLabel(ret.status)}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Customer */}
          <div className="rounded-2xl border p-5 text-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p>{ret.user.name ?? "—"}</p>
            <p className="text-muted-foreground">{ret.user.email}</p>
            {ret.user.phone && <p className="text-muted-foreground">{ret.user.phone}</p>}
            <p className="mt-2 text-muted-foreground">
              Payment: {ret.order.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid (Razorpay)"} ·
              Order total {formatPrice(ret.order.total)}
            </p>
          </div>

          {/* Items */}
          <div className="rounded-2xl border p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <ul className="space-y-3">
              {ret.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md bg-accent/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cldUrl(it.image, { w: 96, h: 96, crop: "fit" })}
                      alt=""
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.variantLabel} · Qty {it.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(it.unitPrice * it.quantity)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {ret.refundStatus === "COMPLETED" ? "Refunded" : "Requested refund"}
              </span>
              <span className="font-semibold">
                {formatPrice(ret.refundedAmount || ret.refundAmount)}
              </span>
            </div>
            {ret.refundStatus === "COMPLETED" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Via {(ret.refundMethod ?? "").replace(/_/g, " ").toLowerCase()}
                {ret.refundRef ? ` · Ref ${ret.refundRef}` : ""}
              </p>
            )}
          </div>

          {/* Reason + description */}
          <div className="rounded-2xl border p-5">
            <h2 className="mb-2 font-semibold">Reason</h2>
            <p className="text-sm">{ret.reason}</p>
            {ret.description && (
              <p className="mt-2 text-sm text-muted-foreground">{ret.description}</p>
            )}
          </div>

          {/* Proof */}
          {ret.media.length > 0 && (
            <div className="rounded-2xl border p-5">
              <h2 className="mb-3 font-semibold">Customer proof</h2>
              <div className="flex flex-wrap gap-2">
                {ret.media.map((url) =>
                  isVideoUrl(url) ? (
                    <video key={url} src={url} controls className="h-28 rounded-lg border bg-black" />
                  ) : (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cldUrl(url, { w: 220, h: 220, crop: "fill" })}
                        alt=""
                        className="size-28 rounded-lg border object-cover"
                      />
                    </a>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="rounded-2xl border p-5">
            <h2 className="mb-3 font-semibold">Actions</h2>
            <ReturnActions
              returnId={ret.id}
              status={ret.status}
              refundAmount={ret.refundAmount}
              hasOnlinePayment={
                ret.order.paymentMethod === "RAZORPAY" && !!ret.order.razorpayPaymentId
              }
            />
          </div>

          {/* Internal notes */}
          {ret.adminNotes && (
            <div className="rounded-2xl border p-5">
              <h2 className="mb-2 font-semibold">Internal notes</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ret.adminNotes}</p>
            </div>
          )}
        </div>

        {/* Audit timeline */}
        <aside className="h-fit rounded-2xl border p-5">
          <h2 className="mb-4 font-semibold">Audit log</h2>
          <ol className="space-y-4">
            {ret.events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{returnStatusLabel(e.status)}</p>
                  {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {e.actor ? `${e.actor} · ` : ""}
                    {formatDateTime(e.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
