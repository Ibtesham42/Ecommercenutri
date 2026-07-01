"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AffiliateStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  approveAffiliate,
  rejectAffiliate,
  suspendAffiliate,
  reactivateAffiliate,
  setAffiliateCommission,
  deleteAffiliate,
} from "@/lib/actions/admin/affiliates";
import type { AdminResult } from "@/lib/actions/admin/types";

export function AffiliateDetailActions({
  affiliateId,
  status,
  hasCoupon,
  commissionType,
  commissionValue,
}: {
  affiliateId: string;
  status: AffiliateStatus;
  hasCoupon: boolean;
  commissionType: string | null;
  commissionValue: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [reason, setReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState("10");
  const [cType, setCType] = useState<string>(commissionType ?? "");
  const [cValue, setCValue] = useState<string>(
    commissionValue != null ? (commissionType === "FIXED" ? (commissionValue / 100).toString() : String(commissionValue)) : "",
  );

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

  // Delete removes the detail record, so route back to the list on success.
  async function runDelete() {
    setPending(true);
    const res = await deleteAffiliate({ affiliateId });
    setPending(false);
    if (res.ok) {
      toast.success("Affiliate deleted");
      setDeleteOpen(false);
      router.push("/admin/affiliates");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "PENDING" || status === "REJECTED") && (
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              Approve
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve affiliate</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {!hasCoupon && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="couponCode">Coupon code (optional)</Label>
                    <Input
                      id="couponCode"
                      placeholder="Auto-generated"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="couponPercent">Coupon %</Label>
                    <Input
                      id="couponPercent"
                      type="number"
                      min={1}
                      max={100}
                      value={couponPercent}
                      onChange={(e) => setCouponPercent(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A referral code already exists; approving creates the coupon and activates the account.
                Commission falls back to the role/store rules unless you set an override below.
              </p>
            </div>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    approveAffiliate({
                      affiliateId,
                      couponCode: couponCode || undefined,
                      couponPercent: couponPercent ? Number(couponPercent) : undefined,
                    }),
                    "Affiliate approved",
                    () => setApproveOpen(false),
                  )
                }
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {status === "PENDING" && (
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive" disabled={pending}>
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject application</DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Reason (shown to the applicant)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending || !reason.trim()}
                onClick={() => run(rejectAffiliate({ affiliateId, reason: reason.trim() }), "Application rejected", () => setRejectOpen(false))}
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {status === "APPROVED" && (
        <>
          <Dialog open={commOpen} onOpenChange={setCommOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                Set commission
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Commission override</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cType">Type</Label>
                  <select id="cType" value={cType} onChange={(e) => setCType(e.target.value)} className={field}>
                    <option value="">Use role / store default</option>
                    <option value="PERCENT">Percentage</option>
                    <option value="FIXED">Fixed (₹ per unit)</option>
                  </select>
                </div>
                {cType && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cValue">{cType === "PERCENT" ? "Percent" : "Amount (₹)"}</Label>
                    <Input id="cValue" type="number" min={0} value={cValue} onChange={(e) => setCValue(e.target.value)} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(
                      setAffiliateCommission({
                        affiliateId,
                        commissionType: cType ? (cType as "PERCENT" | "FIXED") : null,
                        commissionValue: cType
                          ? cType === "FIXED"
                            ? Math.round(Number(cValue) * 100)
                            : Number(cValue)
                          : null,
                      }),
                      "Commission updated",
                      () => setCommOpen(false),
                    )
                  }
                  className="gap-2"
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive" disabled={pending}>
                Suspend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Suspend affiliate</DialogTitle>
              </DialogHeader>
              <Textarea placeholder="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={pending || !reason.trim()}
                  onClick={() => run(suspendAffiliate({ affiliateId, reason: reason.trim() }), "Affiliate suspended", () => setSuspendOpen(false))}
                  className="gap-2"
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Suspend
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {status === "SUSPENDED" && (
        <Button size="sm" disabled={pending} onClick={() => run(reactivateAffiliate({ affiliateId }), "Affiliate reactivated")}>
          Reactivate
        </Button>
      )}

      {(status === "SUSPENDED" || status === "REJECTED") && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive" disabled={pending}>
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete affiliate permanently?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This permanently removes this affiliate and all their affiliate data —
              referral clicks, commissions and payout history. Referred orders are kept
              (their referral snapshot stays) but detached from the affiliate. The
              customer&apos;s account itself is not deleted — they can re-apply later.
              This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={pending} onClick={runDelete} className="gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
