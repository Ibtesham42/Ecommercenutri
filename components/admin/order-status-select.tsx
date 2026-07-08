"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOrderStatus } from "@/lib/actions/admin/orders";
import {
  ADMIN_STATUS_OPTIONS,
  ORDER_STATUS_LABEL,
  statusLabel,
} from "@/lib/order-status";

/** Contextual prompt for the note captured with a status change. */
function notePrompt(status: OrderStatus): { placeholder: string; hint: string } {
  if (status === "SHIPPED" || status === "OUT_FOR_DELIVERY")
    return {
      placeholder: "Tracking number & courier — e.g. Delhivery · AWB 123456789",
      hint: "Add the tracking number and courier so the customer can follow the shipment.",
    };
  if (status === "CANCELLED")
    return {
      placeholder: "Reason for cancellation (shared with the customer)",
      hint: "The reason appears on the order timeline and the cancellation notice.",
    };
  return {
    placeholder: "Add a note for this update (optional)",
    hint: "Notes appear on the order timeline the customer sees.",
  };
}

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [next, setNext] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  function apply() {
    if (!next) return;
    startTransition(async () => {
      const res = await updateOrderStatus({
        orderId,
        status: next,
        reason: note.trim() || undefined,
      });
      if (res.ok) {
        toast.success(`Order marked ${statusLabel(next).toLowerCase()}`);
        setNext(null);
        setNote("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const prompt = next ? notePrompt(next) : null;

  return (
    <>
      <Select
        value={status}
        onValueChange={(v) => {
          if (v !== status) {
            setNext(v as OrderStatus);
            setNote("");
          }
        }}
        disabled={pending}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ADMIN_STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={next !== null} onOpenChange={(o) => !o && !pending && setNext(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark order as {next ? ORDER_STATUS_LABEL[next] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="status-note">Note</Label>
            <Textarea
              id="status-note"
              rows={3}
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={prompt?.placeholder}
            />
            <p className="text-xs text-muted-foreground">{prompt?.hint}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNext(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={pending}>
              {pending ? "Updating…" : `Mark ${next ? statusLabel(next).toLowerCase() : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
