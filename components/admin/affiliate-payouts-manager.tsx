"use client";

import { useState } from "react";
import Link from "next/link";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approvePayout,
  rejectPayout,
  markPayoutPaid,
  runMaturation,
} from "@/lib/actions/admin/affiliates";
import { formatPrice, formatDate } from "@/lib/format";
import { PAYOUT_STATUS_LABEL } from "@/lib/affiliate/labels";
import { payoutAuditLines } from "@/lib/affiliate/payout-audit";
import type { AdminResult } from "@/lib/actions/admin/types";

export type PayoutRow = {
  id: string;
  payoutNumber: string;
  amount: number;
  status: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  commissions: number;
  createdAt: string;
  paidAt: string | null;
  affiliate: {
    id: string;
    code: string;
    displayName: string;
    status: string;
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

const METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  RAZORPAYX: "RazorpayX",
};

function destination(a: PayoutRow["affiliate"]): string | null {
  if (a.payoutMethod === "UPI") return a.upiId;
  const parts = [a.accountName, a.bankName, a.bankAccount, a.bankIfsc].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function AffiliatePayoutsManager({ payouts }: { payouts: PayoutRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [paying, setPaying] = useState<PayoutRow | null>(null);
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [approving, setApproving] = useState<PayoutRow | null>(null); // on-hold approval
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
      toast.success(
        res.data?.count
          ? `${res.data.count} commission(s) are now payable`
          : "Nothing new to approve — commissions become payable after delivery + the return window",
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function openPay(p: PayoutRow) {
    setMethod(p.affiliate.payoutMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "UPI");
    setReference("");
    setConfirmed(false);
    setOverrideReason("");
    setPaying(p);
  }

  const isOnHold = (p: PayoutRow) =>
    p.affiliate.status !== "APPROVED" && ["REQUESTED", "APPROVED", "PROCESSING"].includes(p.status);
  const payingOnHold = !!paying && isOnHold(paying);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Flow: <strong>Requested</strong> → Approve → send the money → <strong>Mark paid</strong> with the UTR.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={maturate}>
          <RefreshCw className="size-4" aria-hidden /> Approve due commissions
        </Button>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No payouts here. Affiliates request a payout from their dashboard once their approved balance reaches the
          minimum.
        </div>
      ) : (
        <ul className="space-y-2">
          {payouts.map((p) => {
            const dest = destination(p.affiliate);
            return (
              <li key={p.id} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-medium">
                      <Link href={`/admin/affiliates/${p.affiliate.id}`} className="hover:underline">
                        {p.affiliate.displayName}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted-foreground">({p.affiliate.code})</span>
                      {isOnHold(p) ? (
                        <Badge variant="destructive" className="ml-2 align-middle">
                          On hold · affiliate {p.affiliate.status.toLowerCase()}
                        </Badge>
                      ) : (
                        p.affiliate.status !== "APPROVED" && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            Affiliate {p.affiliate.status.toLowerCase()}
                          </Badge>
                        )
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.payoutNumber} · requested {formatDate(p.createdAt)} · {p.commissions} commission
                      {p.commissions === 1 ? "" : "s"}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {p.status === "PAID"
                        ? `Paid ${p.paidAt ? formatDate(p.paidAt) : ""} via ${METHOD_LABEL[p.method ?? ""] ?? p.method ?? "—"} · ref ${p.reference ?? "—"}`
                        : p.status === "REJECTED"
                          ? `Rejected${p.notes ? `: ${p.notes}` : ""}`
                          : `To: ${METHOD_LABEL[p.affiliate.payoutMethod ?? ""] ?? "no method"}${dest ? ` · ${dest}` : " · details missing"}`}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                    {PAYOUT_STATUS_LABEL[p.status as keyof typeof PAYOUT_STATUS_LABEL]}
                  </Badge>
                  <span className="font-semibold tabular-nums">{formatPrice(p.amount)}</span>
                  <div className="flex gap-1.5">
                    {p.status === "REQUESTED" && (
                      <Button
                        size="sm"
                        variant={isOnHold(p) ? "outline" : "default"}
                        disabled={pending}
                        onClick={() => {
                          if (isOnHold(p)) {
                            setOverrideReason("");
                            setApproving(p);
                          } else {
                            run(approvePayout({ payoutId: p.id }), "Payout approved — send the money, then mark it paid");
                          }
                        }}
                      >
                        {isOnHold(p) ? "Approve anyway…" : "Approve"}
                      </Button>
                    )}
                    {(p.status === "APPROVED" || p.status === "PROCESSING") && (
                      <Button size="sm" variant={isOnHold(p) ? "outline" : "default"} disabled={pending} onClick={() => openPay(p)}>
                        {isOnHold(p) ? "Mark paid anyway…" : "Mark paid"}
                      </Button>
                    )}
                    {(p.status === "REQUESTED" || p.status === "APPROVED" || p.status === "PROCESSING") && (
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
                    )}
                  </div>
                </div>
                {payoutAuditLines(p.notes).length > 0 && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">History ({payoutAuditLines(p.notes).length})</summary>
                    <ol className="mt-1 space-y-0.5 break-words pl-4">
                      {payoutAuditLines(p.notes).map((l, i) => (
                        <li key={i} className="list-decimal">
                          {l}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Mark-paid dialog: records a transfer that already happened. */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payout of {paying ? formatPrice(paying.amount) : ""}</DialogTitle>
            <DialogDescription>
              Only do this after the money has left your account. The affiliate is emailed the reference.
            </DialogDescription>
          </DialogHeader>
          {paying && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{paying.affiliate.displayName}</p>
                <p className="break-words text-muted-foreground">
                  {METHOD_LABEL[paying.affiliate.payoutMethod ?? ""] ?? "No method"} ·{" "}
                  {destination(paying.affiliate) ?? "no payout details on file"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payMethod">Sent via</Label>
                <select
                  id="payMethod"
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
                <Label htmlFor="payRef">Transfer reference (bank UTR / UPI transaction ID)</Label>
                <Input
                  id="payRef"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. 4123 5678 9012"
                  autoComplete="off"
                />
              </div>
              {payingOnHold && (
                <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <Label htmlFor="payOverride">This affiliate is suspended. Why pay anyway? (recorded)</Label>
                  <Input id="payOverride" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                </div>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I&rsquo;ve confirmed {paying ? formatPrice(paying.amount) : "the amount"} was sent to the account above.
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={
                pending || !confirmed || reference.trim().length < 4 || (payingOnHold && overrideReason.trim().length < 5)
              }
              onClick={() =>
                paying &&
                run(
                  markPayoutPaid({
                    payoutId: paying.id,
                    method,
                    reference,
                    ...(payingOnHold ? { overrideReason } : {}),
                  }),
                  "Payout recorded as paid",
                  () => setPaying(null),
                )
              }
              className="gap-2"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve a payout that's on hold (affiliate suspended) — explicit + recorded */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve a payout on hold?</DialogTitle>
            <DialogDescription>
              {approving?.affiliate.displayName} is suspended, so this {approving ? formatPrice(approving.amount) : ""} payout
              is on hold. Rejecting returns the amount to their balance. Approving anyway is recorded with your name and
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="approveOverride">Reason for approving</Label>
            <Input id="approveOverride" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)} disabled={pending}>
              Keep on hold
            </Button>
            <Button
              disabled={pending || overrideReason.trim().length < 5}
              onClick={() =>
                approving &&
                run(
                  approvePayout({ payoutId: approving.id, overrideReason }),
                  "Payout approved (override recorded)",
                  () => setApproving(null),
                )
              }
            >
              Approve anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payout request</DialogTitle>
            <DialogDescription>
              The affiliate is notified and the amount returns to their available balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rejectReason">Reason (shown to the affiliate)</Label>
            <Input
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. invalid bank details"
            />
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
