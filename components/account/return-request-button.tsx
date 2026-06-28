"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ReturnMediaUpload } from "@/components/account/return-media-upload";
import { requestReturn } from "@/lib/actions/returns";
import { formatPrice } from "@/lib/format";
import { cldUrl } from "@/lib/cld";
import type { ReturnableItem } from "@/lib/returns";

const REASONS = [
  "Damaged or defective",
  "Wrong item received",
  "Item not as described",
  "Quality not satisfactory",
  "Expired / near expiry",
  "No longer needed",
  "Other",
];

export function ReturnRequestButton({
  orderNumber,
  items,
  cloudinaryReady,
}: {
  orderNumber: string;
  items: ReturnableItem[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const selected = items.filter((i) => (qty[i.orderItemId] ?? 0) > 0);
  const refundAmount = selected.reduce(
    (s, i) => s + i.unitPrice * (qty[i.orderItemId] ?? 0),
    0,
  );

  function setItemQty(id: string, q: number, max: number) {
    setQty((cur) => ({ ...cur, [id]: Math.max(0, Math.min(max, q)) }));
  }

  async function onSubmit() {
    if (selected.length === 0) return toast.error("Select at least one item to return.");
    if (!reason) return toast.error("Please select a reason.");
    setPending(true);
    const res = await requestReturn({
      orderNumber,
      reason,
      description: description.trim(),
      media,
      items: selected.map((i) => ({ orderItemId: i.orderItemId, quantity: qty[i.orderItemId] ?? 0 })),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Return request submitted");
      setOpen(false);
      router.push(`/account/returns/${res.returnNumber}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RotateCcw className="size-4" /> Request return / refund
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items + quantities */}
          <div className="space-y-2">
            <Label className="text-sm">Select items to return</Label>
            {items.map((it) => {
              const q = qty[it.orderItemId] ?? 0;
              return (
                <div key={it.orderItemId} className="flex items-center gap-3 rounded-lg border p-2">
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
                      {it.variantLabel} · {formatPrice(it.unitPrice)} · up to {it.returnableQty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => setItemQty(it.orderItemId, q - 1, it.returnableQty)}
                      disabled={q <= 0}
                      aria-label="Decrease"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => setItemQty(it.orderItemId, q + 1, it.returnableQty)}
                      disabled={q >= it.returnableQty}
                      aria-label="Increase"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-sm">Reason</Label>
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

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm">Description (optional)</Label>
            <Textarea
              placeholder="Tell us more about the issue…"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>

          {/* Proof media */}
          <div className="space-y-1.5">
            <Label className="text-sm">Proof (photos / video)</Label>
            <ReturnMediaUpload value={media} onChange={setMedia} cloudinaryReady={cloudinaryReady} />
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Estimated refund</span>
              <span className="font-semibold">{formatPrice(refundAmount)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
