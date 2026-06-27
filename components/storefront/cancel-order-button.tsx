"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelOrder } from "@/lib/actions/account";

const REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Item no longer needed",
  "Delivery taking too long",
  "Other",
];

export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    const finalReason = [reason, note.trim()].filter(Boolean).join(" — ") || undefined;
    const res = await cancelOrder({ orderNumber, reason: finalReason });
    setPending(false);
    if (res.ok) {
      toast.success("Order cancelled");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
          <XCircle className="size-4" /> Cancel order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            Order #{orderNumber} will be cancelled and any reserved stock released.
            This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Reason (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason((cur) => (cur === r ? "" : r))}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    reason === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            placeholder="Tell us more (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep order</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Cancel order
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
