import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReturnTimeline } from "@/components/account/return-timeline";
import { ReturnCustomerActions } from "@/components/account/return-customer-actions";
import { formatPrice, formatDate } from "@/lib/format";
import { returnStatusLabel, returnBadgeVariant } from "@/lib/return-status";
import { cldUrl, isVideoUrl } from "@/lib/cld";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Return details" };

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ returnNumber: string }>;
}) {
  const { returnNumber } = await params;
  const user = await getCurrentUser();

  const ret = await prisma.returnRequest.findFirst({
    where: { returnNumber, userId: user!.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      order: { select: { orderNumber: true } },
      creditNote: { select: { number: true } },
    },
  });
  if (!ret) notFound();

  const refundShown = ret.refundedAmount || ret.refundAmount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account/returns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to returns
        </Link>
        {ret.creditNote && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/credit-notes/${ret.returnNumber}?download=1`}>
              <Download className="size-4" /> Credit note
            </a>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{ret.returnNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Order{" "}
            <Link href={`/account/orders/${ret.order.orderNumber}`} className="text-primary hover:underline">
              #{ret.order.orderNumber}
            </Link>{" "}
            · {formatDate(ret.createdAt)}
          </p>
        </div>
        <Badge variant={returnBadgeVariant[ret.status]} className="text-sm">
          {returnStatusLabel(ret.status)}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
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
                {ret.refundStatus === "COMPLETED" ? "Refunded" : "Estimated refund"}
              </span>
              <span className="font-semibold">{formatPrice(refundShown)}</span>
            </div>
            {ret.refundStatus === "COMPLETED" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Refunded via {(ret.refundMethod ?? "").replace(/_/g, " ").toLowerCase()}
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
            {ret.rejectionReason && ret.status === "REJECTED" && (
              <p className="mt-2 text-sm text-destructive">
                Rejected: {ret.rejectionReason}
              </p>
            )}
          </div>

          {/* Proof */}
          {ret.media.length > 0 && (
            <div className="rounded-2xl border p-5">
              <h2 className="mb-3 font-semibold">Proof</h2>
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

          <ReturnCustomerActions
            returnNumber={ret.returnNumber}
            status={ret.status}
            cloudinaryReady={isConfigured.cloudinary()}
          />
        </div>

        {/* Timeline */}
        <aside className="h-fit rounded-2xl border p-5">
          <h2 className="mb-4 font-semibold">Status</h2>
          <ReturnTimeline
            status={ret.status}
            requestedAt={ret.createdAt.toISOString()}
            rejectionReason={ret.rejectionReason}
            events={ret.events.map((e) => ({
              status: e.status,
              note: e.note,
              createdAt: e.createdAt.toISOString(),
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
