"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveCommission,
  cancelCommission,
  runMaturation,
} from "@/lib/actions/admin/affiliates";
import { formatPrice, formatDate } from "@/lib/format";
import { COMMISSION_STATUS_LABEL } from "@/lib/affiliate/labels";
import type { AdminResult } from "@/lib/actions/admin/types";

export type CommissionRow = {
  id: string;
  amount: number;
  base: number;
  status: string;
  matureAt: string | null;
  createdAt: string;
  order: { orderNumber: string; status: string };
  affiliate: { id: string; code: string; displayName: string };
};

export type CommissionSummary = {
  pending: { amount: number; count: number };
  approved: { amount: number; count: number };
  paid: { amount: number; count: number };
  cancelled: { amount: number; count: number };
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  PAID: "default",
  CANCELLED: "destructive",
};

const FILTERS = ["ALL", "PENDING", "APPROVED", "PAID", "CANCELLED"] as const;

export function AffiliateCommissionsManager({
  commissions,
  summary,
  status,
  search,
}: {
  commissions: CommissionRow[];
  summary: CommissionSummary;
  status: string;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== "ALL") sp.set(key, value);
    else sp.delete(key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  async function run(p: Promise<AdminResult>, ok: string, onDone?: () => void) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (res.ok) {
      toast.success(ok);
      onDone?.();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function maturate() {
    setPending(true);
    const res = await runMaturation();
    setPending(false);
    if (res.ok) {
      toast.success(`Matured ${res.data?.count ?? 0} commission(s)`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const cards = [
    { label: "Pending", ...summary.pending, hint: "Awaiting delivery + return window" },
    { label: "Approved", ...summary.approved, hint: "Payable / awaiting payout" },
    { label: "Paid", ...summary.paid, hint: "Settled via payouts" },
    { label: "Cancelled", ...summary.cancelled, hint: "Returned / voided" },
  ];

  return (
    <div className="space-y-4">
      {/* How approval works */}
      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Commissions become <strong>Approved automatically</strong> once the order is delivered
          and its return window has passed — no manual approval needed. Use <em>Run maturation</em>{" "}
          to sweep due ones now, or approve/cancel a single commission below for edge cases.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">
              {c.label} <span className="tabular-nums">({c.count})</span>
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatPrice(c.amount)}</p>
            <p className="text-[11px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={status === f || (f === "ALL" && status === "ALL") ? "default" : "outline"}
              onClick={() => setParam("status", f)}
            >
              {f === "ALL" ? "All" : COMMISSION_STATUS_LABEL[f as keyof typeof COMMISSION_STATUS_LABEL]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Order # or affiliate…"
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("search", (e.target as HTMLInputElement).value);
            }}
            className="h-9 w-48"
          />
          <Button variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={maturate}>
            <RefreshCw className="size-4" /> Run maturation
          </Button>
        </div>
      </div>

      {/* List */}
      {commissions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No commissions match this view.
        </div>
      ) : (
        <ul className="space-y-2">
          {commissions.map((c) => (
            <li key={c.id} className="rounded-xl border bg-background p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href={`/admin/orders`} className="hover:underline">
                      #{c.order.orderNumber}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">· {c.order.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/admin/affiliates/${c.affiliate.id}`} className="hover:underline">
                      {c.affiliate.displayName}{" "}
                      <span className="font-mono">({c.affiliate.code})</span>
                    </Link>{" "}
                    · {formatDate(c.createdAt)}
                    {c.status === "PENDING" && c.matureAt
                      ? ` · matures ${formatDate(c.matureAt)}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatPrice(c.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">on {formatPrice(c.base)}</p>
                </div>
                <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                  {COMMISSION_STATUS_LABEL[c.status as keyof typeof COMMISSION_STATUS_LABEL]}
                </Badge>
                <div className="flex gap-1.5">
                  {c.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(approveCommission({ commissionId: c.id }), "Commission approved")}
                    >
                      Approve
                    </Button>
                  )}
                  {(c.status === "PENDING" || c.status === "APPROVED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => {
                        setReason("");
                        setCancelId(c.id);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Cancel dialog */}
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel commission</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. fraudulent order" />
            <p className="text-xs text-muted-foreground">
              The affiliate is notified and the amount leaves their balance. This can&rsquo;t be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)} disabled={pending}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              className="gap-2"
              onClick={() =>
                cancelId &&
                run(cancelCommission({ commissionId: cancelId, reason }), "Commission cancelled", () =>
                  setCancelId(null),
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Cancel commission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
