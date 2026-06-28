"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReturnStatus } from "@prisma/client";
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
  reviewReturn,
  approveReturn,
  rejectReturn,
  requestReturnInfo,
  scheduleReturnPickup,
  addReturnNote,
  processReturnRefund,
} from "@/lib/actions/admin/returns";
import { isReturnTerminal } from "@/lib/return-status";
import type { AdminResult } from "@/lib/actions/admin/types";

type Props = {
  returnId: string;
  status: ReturnStatus;
  refundAmount: number; // paise
  hasOnlinePayment: boolean;
};

const METHODS = [
  { value: "ORIGINAL", label: "Original payment (Razorpay)" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "STORE_CREDIT", label: "Store credit" },
  { value: "OTHER", label: "Other" },
];

export function ReturnActions({ returnId, status, refundAmount, hasOnlinePayment }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState((refundAmount / 100).toString());
  const [method, setMethod] = useState(hasOnlinePayment ? "ORIGINAL" : "UPI");
  const [reference, setReference] = useState("");

  const terminal = isReturnTerminal(status);

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

  if (terminal) {
    return (
      <p className="text-sm text-muted-foreground">
        This return is closed — no further actions are available.
      </p>
    );
  }

  const refunded = status === "REFUNDED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "REQUESTED" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(reviewReturn({ returnId }), "Marked under review")}
          >
            Mark under review
          </Button>
        )}
        {!refunded && status !== "APPROVED" && status !== "PICKUP_SCHEDULED" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(approveReturn({ returnId }), "Return approved")}
          >
            Approve
          </Button>
        )}

        {/* Schedule pickup */}
        <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>
              Schedule pickup
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule reverse pickup</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pickup-date">Pickup date</Label>
                <Input
                  id="pickup-date"
                  type="date"
                  value={pickupAt}
                  onChange={(e) => setPickupAt(e.target.value)}
                />
              </div>
              <Textarea
                placeholder="Pickup note (optional)"
                rows={2}
                value={pickupNote}
                onChange={(e) => setPickupNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={pending || !pickupAt}
                onClick={() =>
                  run(
                    scheduleReturnPickup({ returnId, pickupAt, note: pickupNote }),
                    "Pickup scheduled",
                    () => setPickupOpen(false),
                  )
                }
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request info */}
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>
              Request info
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request more information</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="What do you need from the customer?"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <DialogFooter>
              <Button
                disabled={pending || !message.trim()}
                onClick={() =>
                  run(
                    requestReturnInfo({ returnId, message: message.trim() }),
                    "Information requested",
                    () => {
                      setInfoOpen(false);
                      setMessage("");
                    },
                  )
                }
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Send request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive" disabled={pending}>
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject return</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason shown to the customer…"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending || !reason.trim()}
                onClick={() =>
                  run(rejectReturn({ returnId, reason: reason.trim() }), "Return rejected", () => {
                    setRejectOpen(false);
                    setReason("");
                  })
                }
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Reject return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Process refund */}
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              Process refund
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process refund</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="refund-amount">Amount (₹)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Returnable value: ₹{(refundAmount / 100).toFixed(2)} — enter less for a partial refund.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="refund-method">Method</Label>
                <select
                  id="refund-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {METHODS.filter((m) => m.value !== "ORIGINAL" || hasOnlinePayment).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {method !== "ORIGINAL" && (
                <div className="space-y-1.5">
                  <Label htmlFor="refund-ref">Reference (UTR / UPI id)</Label>
                  <Input
                    id="refund-ref"
                    placeholder="e.g. UPI ref / bank UTR"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                disabled={pending || !(Number(amount) > 0)}
                onClick={() =>
                  run(
                    processReturnRefund({
                      returnId,
                      amount: Math.round(Number(amount) * 100),
                      method,
                      reference,
                    }),
                    "Refund processed",
                    () => setRefundOpen(false),
                  )
                }
                className="gap-2"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Process refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Internal note */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Label htmlFor="admin-note" className="text-xs text-muted-foreground">
          Add an internal note (not visible to the customer)
        </Label>
        <div className="flex gap-2">
          <Input
            id="admin-note"
            placeholder="Internal note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={pending || !note.trim()}
            onClick={() =>
              run(addReturnNote({ returnId, note: note.trim() }), "Note added", () => setNote(""))
            }
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
