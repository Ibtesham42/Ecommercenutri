"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  approvePayout,
  rejectPayout,
  markPayoutPaid,
  runMaturation,
} from "@/lib/actions/admin/affiliates";
import { formatPrice, formatDate } from "@/lib/format";
import { PAYOUT_STATUS_LABEL } from "@/lib/affiliate/labels";
import type { AdminResult } from "@/lib/actions/admin/types";

export type PayoutRow = {
  id: string;
  payoutNumber: string;
  amount: number;
  status: string;
  method: string | null;
  reference: string | null;
  createdAt: string;
  affiliate: {
    code: string;
    displayName: string;
    payoutMethod: string | null;
    upiId: string | null;
    bankAccount: string | null;
    bankIfsc: string | null;
    bankName: string | null;
    accountName: string | null;
    user: { email: string | null };
  };
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  REQUESTED: "secondary",
  APPROVED: "outline",
  PROCESSING: "outline",
  PAID: "default",
  REJECTED: "destructive",
};

export function AffiliatePayoutsManager({ payouts }: { payouts: PayoutRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={maturate}>
          <RefreshCw className="size-4" /> Run maturation
        </Button>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No payout requests.
        </div>
      ) : (
        <ul className="space-y-2">
          {payouts.map((p) => {
            const acct =
              p.affiliate.payoutMethod === "UPI"
                ? p.affiliate.upiId
                : [p.affiliate.accountName, p.affiliate.bankName, p.affiliate.bankAccount, p.affiliate.bankIfsc]
                    .filter(Boolean)
                    .join(" · ");
            return (
              <li key={p.id} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.affiliate.displayName}{" "}
                      <span className="font-mono text-xs text-muted-foreground">({p.affiliate.code})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.payoutNumber} · {formatDate(p.createdAt)} ·{" "}
                      {p.affiliate.payoutMethod ?? "no method"} {acct ? `· ${acct}` : ""}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                    {PAYOUT_STATUS_LABEL[p.status as keyof typeof PAYOUT_STATUS_LABEL]}
                  </Badge>
                  <span className="font-semibold">{formatPrice(p.amount)}</span>
                  <div className="flex gap-1.5">
                    {p.status === "REQUESTED" && (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(approvePayout({ payoutId: p.id }), "Payout approved")}>
                        Approve
                      </Button>
                    )}
                    {(p.status === "REQUESTED" || p.status === "APPROVED") && (
                      <>
                        <Dialog open={payOpen === p.id} onOpenChange={(o) => setPayOpen(o ? p.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" disabled={pending}>
                              Mark paid
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Mark payout paid</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Method</Label>
                                <select
                                  value={method}
                                  onChange={(e) => setMethod(e.target.value)}
                                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                                >
                                  <option value="UPI">UPI</option>
                                  <option value="BANK_TRANSFER">Bank transfer</option>
                                  <option value="RAZORPAYX">RazorpayX</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Reference (UTR / UPI id)</Label>
                                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    markPayoutPaid({ payoutId: p.id, method, reference }),
                                    "Payout marked paid",
                                    () => setPayOpen(null),
                                  )
                                }
                                className="gap-2"
                              >
                                {pending && <Loader2 className="size-4 animate-spin" />}
                                Confirm
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={pending}
                          onClick={() => {
                            setRejectReason("");
                            setRejectId(p.id);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payout request</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. invalid bank details"
            />
            <p className="text-xs text-muted-foreground">
              The affiliate is notified and the amount returns to their available balance.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)} disabled={pending}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              className="gap-2"
              onClick={() =>
                rejectId &&
                run(
                  rejectPayout({ payoutId: rejectId, reason: rejectReason }),
                  "Payout rejected",
                  () => setRejectId(null),
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Reject payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
