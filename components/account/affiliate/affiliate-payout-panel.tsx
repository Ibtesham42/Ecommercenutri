"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updatePayoutDetails, requestPayout } from "@/lib/actions/affiliate";
import { formatPrice } from "@/lib/format";

type Values = {
  payoutMethod: string;
  upiId: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  accountName: string;
};

export function AffiliatePayoutPanel({
  available,
  minPayout,
  openPayout,
  hasDetails,
  initial,
}: {
  available: number;
  minPayout: number;
  openPayout: { amount: number; status: string } | null;
  hasDetails: boolean;
  initial: Partial<Values>;
}) {
  const router = useRouter();
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { register, handleSubmit, watch } = useForm<Values>({
    defaultValues: {
      payoutMethod: initial.payoutMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "UPI",
      upiId: initial.upiId ?? "",
      bankName: initial.bankName ?? "",
      bankAccount: initial.bankAccount ?? "",
      bankIfsc: initial.bankIfsc ?? "",
      accountName: initial.accountName ?? "",
    },
  });
  const method = watch("payoutMethod");

  async function saveDetails(v: Values) {
    setSavingDetails(true);
    setDetailsError(null);
    const res = await updatePayoutDetails(v);
    setSavingDetails(false);
    if (res.ok) {
      toast.success("Payout details saved");
      router.refresh();
    } else {
      setDetailsError(res.error);
    }
  }

  async function onRequest() {
    setRequesting(true);
    const res = await requestPayout();
    setRequesting(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success("Payout requested — we'll let you know when it's sent.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";
  const canRequest = !openPayout && hasDetails && available >= minPayout && available > 0;
  const hint = openPayout
    ? `Your payout of ${formatPrice(openPayout.amount)} is ${openPayout.status.toLowerCase()}. You can request the next one once it's paid.`
    : !hasDetails
      ? "Add your UPI or bank details below to withdraw."
      : available < minPayout
        ? `You can withdraw once ${formatPrice(minPayout)} is ready (${formatPrice(minPayout - available)} to go).`
        : null;

  return (
    <div className="space-y-4">
      <section aria-labelledby="withdraw-h" className="rounded-xl border border-border p-5">
        <p id="withdraw-h" className="text-sm text-muted-foreground">
          Ready to withdraw
        </p>
        <p className="text-2xl font-bold tabular-nums">{formatPrice(available)}</p>
        <Button onClick={() => setConfirmOpen(true)} disabled={!canRequest || requesting} className="mt-3 w-full gap-2">
          {requesting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" aria-hidden />}
          Request payout
        </Button>
        {hint && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a payout of {formatPrice(available)}?</DialogTitle>
            <DialogDescription>
              We&rsquo;ll send it to your saved {method === "UPI" ? "UPI ID" : "bank account"} after a quick review
              and email you the transfer reference once it&rsquo;s sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={requesting}>
              Not now
            </Button>
            <Button onClick={onRequest} disabled={requesting} className="gap-2">
              {requesting && <Loader2 className="size-4 animate-spin" />}
              Request payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form
        onSubmit={handleSubmit(saveDetails)}
        className="space-y-3 rounded-xl border border-border p-5"
        aria-labelledby="payout-details-h"
        noValidate
      >
        <div>
          <p id="payout-details-h" className="text-sm font-semibold">
            Payout details
          </p>
          <p className="text-xs text-muted-foreground">Where we send your earnings. Only our team can see this.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payoutMethod">Method</Label>
          <select id="payoutMethod" {...register("payoutMethod")} className={field}>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </div>

        {method === "UPI" ? (
          <div className="space-y-1.5">
            <Label htmlFor="upiId">UPI ID</Label>
            <Input id="upiId" placeholder="name@okbank" autoComplete="off" {...register("upiId")} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-1.5">
              <Label htmlFor="accountName">Account holder name</Label>
              <Input id="accountName" autoComplete="name" {...register("accountName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" {...register("bankName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">Account number</Label>
              <Input id="bankAccount" inputMode="numeric" autoComplete="off" {...register("bankAccount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankIfsc">IFSC code</Label>
              <Input id="bankIfsc" placeholder="HDFC0001234" autoComplete="off" className="uppercase" {...register("bankIfsc")} />
            </div>
          </div>
        )}

        {detailsError && (
          <p role="alert" className="text-sm text-destructive">
            {detailsError}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm" disabled={savingDetails} className="gap-2">
          {savingDetails && <Loader2 className="size-4 animate-spin" />}
          Save details
        </Button>
      </form>
    </div>
  );
}
